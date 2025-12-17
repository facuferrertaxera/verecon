sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Sorter",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/ui/table/Column",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/ColumnListItem",
    "sap/m/SearchField",
    "sap/m/Token",
    "tech/taxera/taxreporting/verecon/utils/types",
    "tech/taxera/taxreporting/verecon/utils/formatter"
], (Controller, Sorter, MessageToast, MessageBox, Filter, FilterOperator, JSONModel, ValueHelpDialog, UITableColumn, MColumn, Text, Label, ColumnListItem, SearchField, Token, types, formatter) => {
    "use strict";

    const MainController = Controller.extend("tech.taxera.taxreporting.verecon.controller.Main", {
        // Add types and formatter to controller instance
        types: types,
        formatter: formatter,
        onInit() {
            // Initialize view model
            const oViewModel = new JSONModel({
                reconciliationList: {
                    headerExpanded: true,
                    bEditMode: false,
                    bDeleteEnabled: false
                },
                busyIndicatorDelay: 0,
                filters: {
                    selectedCountries: [],
                    selectedCountriesDisplay: "",
                    selectedCompanyCodes: [],
                    selectedCompanyCodesDisplay: "",
                    availableCountries: [],
                    availableCompanyCodes: []
                }
            });
            this.getView().setModel(oViewModel, "view");

            // Initialize country and company code maps
            this._mCountryMap = {};
            this._mCompanyCodeMap = {};

            // Set controller reference in formatter for token formatting
            formatter.setController(this);

            // Attach route matched handler if routing is available
            const oRouter = this.getOwnerComponent().getRouter();
            if (oRouter) {
                const oRoute = oRouter.getRoute("RouteMain");
                if (oRoute) {
                    oRoute.attachMatched(this._onReconciliationListMatched, this);
                }
            }

            // Attach to SmartFilterBar initialized event to ensure custom controls are visible
            this.getView().attachAfterRendering(() => {
                const oSmartFilterBar = this.getView().byId("smartFilterBar");
                if (oSmartFilterBar) {
                    console.log("[onInit] Attaching to SmartFilterBar initialized event");
                    oSmartFilterBar.attachInitialized(this._onSmartFilterBarInitialized.bind(this));
                } else {
                    console.warn("[onInit] SmartFilterBar not found in afterRendering");
                }
            });

            // Attach to table dataReceived event to populate tokenizers
            this.getView().attachAfterRendering(() => {
                const oTable = this.getView().byId("reconcilesTable");
                if (oTable) {
                    const oBinding = oTable.getBinding("items");
                    if (oBinding) {
                        oBinding.attachEvent("dataReceived", this._onTableDataReceived.bind(this));
                    } else {
                        // If binding not ready, try again after a delay
                        setTimeout(() => {
                            const oBindingRetry = oTable.getBinding("items");
                            if (oBindingRetry) {
                                oBindingRetry.attachEvent("dataReceived", this._onTableDataReceived.bind(this));
                            }
                        }, 500);
                    }
                }
            });
        },

        /**
         * Load available countries from Country entity set
         */
        _loadAvailableCountries: function() {
            const oModel = this.getModel();
            if (!oModel) {
                return;
            }

            // Read countries from Country entity set
            // For OData v2, response is in oResponse.results
            oModel.read("/Country", {
                urlParameters: {
                    "$select": "Country,Country_Text,CountryName"
                },
                sorters: [
                    new Sorter("Country", false)
                ],
                success: (oResponse) => {
                    // OData v2 uses results array
                    const aResults = oResponse.results || [];
                    const aCountries = aResults.map((oCountry) => {
                        return {
                            code: oCountry.Country,
                            name: oCountry.Country_Text || oCountry.CountryName || oCountry.Country,
                            selected: false
                        };
                    });

                    // Create country code to name mapping for formatter
                    this._mCountryMap = {};
                    aResults.forEach((oCountry) => {
                        this._mCountryMap[oCountry.Country] = oCountry.Country_Text || oCountry.CountryName || oCountry.Country;
                    });

                    console.log("[_loadAvailableCountries] Country map populated with", Object.keys(this._mCountryMap).length, "countries");

                    // Update view model
                    this.getView().getModel("view").setProperty("/filters/availableCountries", aCountries);
                    
                    // Refresh tokenizers in table if data is already loaded
                    // This ensures country names are displayed correctly even if formatter ran before map was ready
                    this._refreshTableTokenizers();
                },
                error: (oError) => {
                    // If error loading, fall back to empty array or show error
                    console.error("[_loadAvailableCountries] Error loading countries:", oError);
                    this.getView().getModel("view").setProperty("/filters/availableCountries", []);
                }
            });
        },

        /**
         * Load available company codes from CompanyVH entity set
         */
        _loadAvailableCompanyCodes: function() {
            const oModel = this.getModel();
            if (!oModel) {
                return;
            }

            // Read company codes from CompanyVH entity set
            // For OData v2, response is in oResponse.results
            oModel.read("/CompanyVH", {
                urlParameters: {
                    "$select": "CompanyCode,Name,Country,CountryName"
                },
                sorters: [
                    new Sorter("CompanyCode", false)
                ],
                success: (oResponse) => {
                    // OData v2 uses results array
                    const aResults = oResponse.results || [];
                    const aCompanyCodes = aResults.map((oCompany) => {
                        return {
                            code: oCompany.CompanyCode,
                            name: oCompany.Name || oCompany.CompanyCode,
                            selected: false
                        };
                    });

                    // Create company code to name mapping for formatter
                    this._mCompanyCodeMap = {};
                    aResults.forEach((oCompany) => {
                        this._mCompanyCodeMap[oCompany.CompanyCode] = oCompany.Name || oCompany.CompanyCode;
                    });

                    console.log("[_loadAvailableCompanyCodes] Company code map populated with", Object.keys(this._mCompanyCodeMap).length, "company codes");

                    // Update view model
                    this.getView().getModel("view").setProperty("/filters/availableCompanyCodes", aCompanyCodes);
                    
                    // Refresh tokenizers in table if data is already loaded
                    this._refreshTableTokenizers();
                },
                error: (oError) => {
                    // If error loading, fall back to empty array or show error
                    console.error("[_loadAvailableCompanyCodes] Error loading company codes:", oError);
                    this.getView().getModel("view").setProperty("/filters/availableCompanyCodes", []);
                }
            });
        },

        /**
         * Get the router instance
         */
        getRouter: function() {
            return this.getOwnerComponent().getRouter();
        },

        /**
         * Get the default model
         */
        getModel: function(sName) {
            return this.getView().getModel(sName);
        },

        /**
         * Get i18n text
         */
        i18n: function(sKey, aParams) {
            const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            return oResourceBundle.getText(sKey, aParams);
        },

        /**
         * Show error message
         */
        showErrorMessage: function(oError) {
            let sMessage = this.i18n("error.generic");
            if (oError && oError.message) {
                sMessage = oError.message;
            } else if (oError && typeof oError === "string") {
                sMessage = oError;
            }
            MessageBox.error(sMessage);
        },

        /**
         * Handler for the Reconciliation List route matched
         */
        _onReconciliationListMatched: function() {
            console.log("[_onReconciliationListMatched] Route matched");
            const oModel = this.getModel();
            if (oModel && oModel.hasPendingChanges && oModel.hasPendingChanges(true)) {
                console.log("[_onReconciliationListMatched] Resetting pending changes");
                oModel.resetChanges();
            }
            
            // Load countries and company codes from service
            // This happens here because OData model metadata may not be ready in onInit
            console.log("[_onReconciliationListMatched] Loading countries and company codes");
            this._loadAvailableCountries();
            this._loadAvailableCompanyCodes();
            
            // Note: Filter controls visibility is handled in _onSmartFilterBarInitialized event
            // which fires after SmartFilterBar is fully initialized
            
            console.log("[_onReconciliationListMatched] Refreshing view");
            this._refreshView();
        },

        /**
         * Handler for SmartFilterBar initialized event
         * This fires after the FilterBar has been initialized, the user's default variant
         * has been applied, and a stable filter state has been achieved
         */
        _onSmartFilterBarInitialized: function(oEvent) {
            console.log("[_onSmartFilterBarInitialized] SmartFilterBar initialized event fired");
            const oSmartFilterBar = oEvent.getSource();
            console.log("[_onSmartFilterBarInitialized] SmartFilterBar isInitialised:", typeof oSmartFilterBar.isInitialised === "function" ? oSmartFilterBar.isInitialised() : "method not available");
            
            // Now we can safely ensure filter controls are visible
            this._ensureFilterControlsVisible();
        },

        /**
         * Ensure custom filter controls are visible in SmartFilterBar
         * This is called after SmartFilterBar is initialized, so filter items should be available
         */
        _ensureFilterControlsVisible: function() {
            console.log("[_ensureFilterControlsVisible] Function called");
            const oSmartFilterBar = this.getView().byId("smartFilterBar");
            if (!oSmartFilterBar) {
                console.warn("[_ensureFilterControlsVisible] SmartFilterBar not found!");
                return;
            }
            console.log("[_ensureFilterControlsVisible] SmartFilterBar found:", oSmartFilterBar.getId());

            try {
                // Try to access ControlConfiguration aggregation directly
                console.log("[_ensureFilterControlsVisible] Checking ControlConfiguration aggregation...");
                const aControlConfigs = oSmartFilterBar.getControlConfiguration ? oSmartFilterBar.getControlConfiguration() : [];
                console.log("[_ensureFilterControlsVisible] ControlConfiguration items:", aControlConfigs ? aControlConfigs.length : "null");
                
                if (aControlConfigs && aControlConfigs.length > 0) {
                    aControlConfigs.forEach((oConfig, iIndex) => {
                        const sKey = oConfig.getKey ? oConfig.getKey() : (oConfig.key || "unknown");
                        console.log(`[_ensureFilterControlsVisible] ControlConfig[${iIndex}]:`, {
                            key: sKey,
                            visible: oConfig.getVisible ? oConfig.getVisible() : "N/A",
                            visibleInAdvancedArea: oConfig.getVisibleInAdvancedArea ? oConfig.getVisibleInAdvancedArea() : "N/A"
                        });
                        
                        if (sKey === "CountryList" || sKey === "CompanyCodeList") {
                            console.log(`[_ensureFilterControlsVisible] Found target ControlConfig: ${sKey}`);
                            if (typeof oConfig.setVisible === "function") {
                                oConfig.setVisible(true);
                                console.log(`[_ensureFilterControlsVisible] Set ControlConfig ${sKey} visible:`, oConfig.getVisible());
                            }
                            if (typeof oConfig.setVisibleInAdvancedArea === "function") {
                                oConfig.setVisibleInAdvancedArea(false);
                                console.log(`[_ensureFilterControlsVisible] Set ControlConfig ${sKey} visibleInAdvancedArea: false`);
                            }
                        }
                    });
                }

                // Directly access the MultiInput controls by ID and ensure they're visible
                const oCountryInput = this.getView().byId("countryListFilter");
                const oCompanyCodeInput = this.getView().byId("companyCodeListFilter");
                
                console.log("[_ensureFilterControlsVisible] CountryInput found:", !!oCountryInput, oCountryInput ? oCountryInput.getId() : "N/A");
                console.log("[_ensureFilterControlsVisible] CompanyCodeInput found:", !!oCompanyCodeInput, oCompanyCodeInput ? oCompanyCodeInput.getId() : "N/A");
                
                if (oCountryInput) {
                    console.log("[_ensureFilterControlsVisible] Setting CountryInput visible");
                    oCountryInput.setVisible(true);
                    console.log("[_ensureFilterControlsVisible] CountryInput visible:", oCountryInput.getVisible());
                    // Also ensure parent is visible if it exists
                    const oCountryParent = oCountryInput.getParent();
                    if (oCountryParent) {
                        console.log("[_ensureFilterControlsVisible] CountryInput parent:", oCountryParent.getId(), oCountryParent.getMetadata().getName());
                        if (oCountryParent.setVisible) {
                            oCountryParent.setVisible(true);
                            console.log("[_ensureFilterControlsVisible] CountryInput parent visible:", oCountryParent.getVisible());
                        }
                    }
                } else {
                    console.warn("[_ensureFilterControlsVisible] CountryInput NOT FOUND by ID 'countryListFilter'");
                }
                
                if (oCompanyCodeInput) {
                    console.log("[_ensureFilterControlsVisible] Setting CompanyCodeInput visible");
                    oCompanyCodeInput.setVisible(true);
                    console.log("[_ensureFilterControlsVisible] CompanyCodeInput visible:", oCompanyCodeInput.getVisible());
                    // Also ensure parent is visible if it exists
                    const oCompanyCodeParent = oCompanyCodeInput.getParent();
                    if (oCompanyCodeParent) {
                        console.log("[_ensureFilterControlsVisible] CompanyCodeInput parent:", oCompanyCodeParent.getId(), oCompanyCodeParent.getMetadata().getName());
                        if (oCompanyCodeParent.setVisible) {
                            oCompanyCodeParent.setVisible(true);
                            console.log("[_ensureFilterControlsVisible] CompanyCodeInput parent visible:", oCompanyCodeParent.getVisible());
                        }
                    }
                } else {
                    console.warn("[_ensureFilterControlsVisible] CompanyCodeInput NOT FOUND by ID 'companyCodeListFilter'");
                }

                // Get all filter items and update visibility
                console.log("[_ensureFilterControlsVisible] Checking SmartFilterBar methods...");
                console.log("[_ensureFilterControlsVisible] getAllFilterItems exists:", typeof oSmartFilterBar.getAllFilterItems === "function");
                console.log("[_ensureFilterControlsVisible] getFilterItems exists:", typeof oSmartFilterBar.getFilterItems === "function");
                console.log("[_ensureFilterControlsVisible] getControlConfiguration exists:", typeof oSmartFilterBar.getControlConfiguration === "function");
                
                let aFilterItems = [];
                if (typeof oSmartFilterBar.getAllFilterItems === "function") {
                    aFilterItems = oSmartFilterBar.getAllFilterItems();
                    console.log("[_ensureFilterControlsVisible] getAllFilterItems returned:", aFilterItems ? aFilterItems.length : "null", "items");
                } else if (typeof oSmartFilterBar.getFilterItems === "function") {
                    aFilterItems = oSmartFilterBar.getFilterItems();
                    console.log("[_ensureFilterControlsVisible] getFilterItems returned:", aFilterItems ? aFilterItems.length : "null", "items");
                } else {
                    console.warn("[_ensureFilterControlsVisible] Neither getAllFilterItems nor getFilterItems available!");
                }

                if (aFilterItems && aFilterItems.length > 0) {
                    console.log("[_ensureFilterControlsVisible] Processing", aFilterItems.length, "filter items");
                    aFilterItems.forEach((oFilterItem, iIndex) => {
                        let sKey = null;
                        // Try different methods to get the key/name
                        if (typeof oFilterItem.getKey === "function") {
                            sKey = oFilterItem.getKey();
                        } else if (typeof oFilterItem.getName === "function") {
                            sKey = oFilterItem.getName();
                        } else if (oFilterItem.key) {
                            sKey = oFilterItem.key;
                        } else if (oFilterItem.name) {
                            sKey = oFilterItem.name;
                        }
                        
                        console.log(`[_ensureFilterControlsVisible] FilterItem[${iIndex}]:`, {
                            key: sKey,
                            type: oFilterItem.getMetadata ? oFilterItem.getMetadata().getName() : "unknown",
                            hasGetKey: typeof oFilterItem.getKey === "function",
                            hasGetName: typeof oFilterItem.getName === "function",
                            hasSetVisible: typeof oFilterItem.setVisible === "function",
                            hasSetVisibleInAdvancedArea: typeof oFilterItem.setVisibleInAdvancedArea === "function",
                            visible: oFilterItem.getVisible ? oFilterItem.getVisible() : "N/A"
                        });

                        if (sKey === "CountryList" || sKey === "CompanyCodeList") {
                            console.log(`[_ensureFilterControlsVisible] Found target filter item: ${sKey}`);
                            
                            // Log current state
                            console.log(`[_ensureFilterControlsVisible] ${sKey} current state:`, {
                                visible: oFilterItem.getVisible ? oFilterItem.getVisible() : "N/A",
                                visibleInAdvancedArea: oFilterItem.getVisibleInAdvancedArea ? oFilterItem.getVisibleInAdvancedArea() : "N/A",
                                getParent: typeof oFilterItem.getParent === "function" ? "exists" : "N/A"
                            });
                            
                            if (typeof oFilterItem.setVisible === "function") {
                                oFilterItem.setVisible(true);
                                console.log(`[_ensureFilterControlsVisible] Set ${sKey} visible:`, oFilterItem.getVisible ? oFilterItem.getVisible() : "N/A");
                            } else {
                                console.warn(`[_ensureFilterControlsVisible] ${sKey} filterItem has no setVisible method`);
                            }
                            if (typeof oFilterItem.setVisibleInAdvancedArea === "function") {
                                oFilterItem.setVisibleInAdvancedArea(false);
                                console.log(`[_ensureFilterControlsVisible] Set ${sKey} visibleInAdvancedArea: false, actual:`, oFilterItem.getVisibleInAdvancedArea ? oFilterItem.getVisibleInAdvancedArea() : "N/A");
                            } else {
                                console.warn(`[_ensureFilterControlsVisible] ${sKey} filterItem has no setVisibleInAdvancedArea method`);
                            }
                            
                            // Try to get the control from the filter item and ensure it's visible
                            if (typeof oFilterItem.getControl === "function") {
                                const oFilterControl = oFilterItem.getControl();
                                if (oFilterControl) {
                                    console.log(`[_ensureFilterControlsVisible] ${sKey} filter control:`, oFilterControl.getId(), oFilterControl.getMetadata().getName());
                                    if (typeof oFilterControl.setVisible === "function") {
                                        oFilterControl.setVisible(true);
                                        console.log(`[_ensureFilterControlsVisible] ${sKey} filter control visible:`, oFilterControl.getVisible());
                                    }
                                    // Check if control has a DOM reference
                                    const oDomRef = oFilterControl.getDomRef ? oFilterControl.getDomRef() : null;
                                    console.log(`[_ensureFilterControlsVisible] ${sKey} filter control DOM ref:`, oDomRef ? "exists" : "null");
                                } else {
                                    console.warn(`[_ensureFilterControlsVisible] ${sKey} filterItem.getControl() returned null`);
                                }
                            }
                            
                            // Check if filter item has a DOM reference
                            const oFilterItemDomRef = oFilterItem.getDomRef ? oFilterItem.getDomRef() : null;
                            console.log(`[_ensureFilterControlsVisible] ${sKey} filter item DOM ref:`, oFilterItemDomRef ? "exists" : "null");
                            
                            // Try to get parent and ensure it's visible
                            if (typeof oFilterItem.getParent === "function") {
                                const oParent = oFilterItem.getParent();
                                if (oParent) {
                                    console.log(`[_ensureFilterControlsVisible] ${sKey} filter item parent:`, oParent.getId(), oParent.getMetadata().getName());
                                    if (typeof oParent.setVisible === "function") {
                                        oParent.setVisible(true);
                                        console.log(`[_ensureFilterControlsVisible] ${sKey} filter item parent visible:`, oParent.getVisible());
                                    }
                                }
                            }
                        }
                    });
                } else {
                    console.warn("[_ensureFilterControlsVisible] No filter items found or empty array");
                }

                // Try to expand filter bar if collapsed
                if (typeof oSmartFilterBar.setFilterBarExpanded === "function") {
                    console.log("[_ensureFilterControlsVisible] Expanding filter bar");
                    oSmartFilterBar.setFilterBarExpanded(true);
                } else {
                    console.log("[_ensureFilterControlsVisible] setFilterBarExpanded method not available");
                }
                
                // Try to get the FilterGroup and show items there
                if (typeof oSmartFilterBar.getFilterGroup === "function") {
                    const oFilterGroup = oSmartFilterBar.getFilterGroup();
                    console.log("[_ensureFilterControlsVisible] FilterGroup:", oFilterGroup ? oFilterGroup.getId() : "null");
                    if (oFilterGroup) {
                        // Try to get all group items
                        if (typeof oFilterGroup.getGroupItems === "function") {
                            const aGroupItems = oFilterGroup.getGroupItems();
                            console.log("[_ensureFilterControlsVisible] FilterGroup items:", aGroupItems ? aGroupItems.length : "null");
                        }
                    }
                }
                
                // Try to use showFilterItem method if available
                if (typeof oSmartFilterBar.showFilterItem === "function") {
                    console.log("[_ensureFilterControlsVisible] Using showFilterItem method");
                    oSmartFilterBar.showFilterItem("CountryList");
                    oSmartFilterBar.showFilterItem("CompanyCodeList");
                } else {
                    console.log("[_ensureFilterControlsVisible] showFilterItem method not available");
                }
                
                // Check if SmartFilterBar has a method to show filters in basic area
                if (typeof oSmartFilterBar.showFiltersInBasicArea === "function") {
                    console.log("[_ensureFilterControlsVisible] Using showFiltersInBasicArea method");
                    oSmartFilterBar.showFiltersInBasicArea(["CountryList", "CompanyCodeList"]);
                } else {
                    console.log("[_ensureFilterControlsVisible] showFiltersInBasicArea method not available");
                }
                
                // Force a re-render or update of the SmartFilterBar
                if (typeof oSmartFilterBar.invalidate === "function") {
                    console.log("[_ensureFilterControlsVisible] Invalidating SmartFilterBar to force re-render");
                    oSmartFilterBar.invalidate();
                }
            } catch (oError) {
                console.error("[_ensureFilterControlsVisible] Error:", oError);
                console.error("[_ensureFilterControlsVisible] Error stack:", oError.stack);
            }
        },

        /**
         * Refresh the view
         */
        _refreshView: function() {
            const oTable = this.getView().byId("reconcilesTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
        },

        /**
         * Handler for Create button
         */
        onReconciliationCreate: function() {
            // TODO: Implement create reconciliation dialog/navigation
            MessageToast.show(this.i18n("reconciliationList.CreateNotImplemented"));
        },

        /**
         * Handler for row press
         */
        onReconciliationPress: function(oEvent) {
            const oReconciliation = oEvent.getSource().getBindingContext().getObject();
            // TODO: Navigate to detail view based on status
            // For now, just show a message
            MessageToast.show(this.i18n("reconciliationList.NavigateToDetail"));
        },

        /**
         * Handler before rebind table
         */
        onBeforeRebindTable: function(oEvent) {
            const mBindingParams = oEvent.getParameter("bindingParams");
            const oViewModel = this.getView().getModel("view");
            const aSelectedCountries = oViewModel.getProperty("/filters/selectedCountries") || [];
            const aSelectedCompanyCodes = oViewModel.getProperty("/filters/selectedCompanyCodes") || [];
            
            // Initialize filters array if not exists
            if (!mBindingParams.filters) {
                mBindingParams.filters = [];
            }

            // Build OR filter for countries
            // For comma-separated values like "RO,PL,DK", we need to check if any selected country is in the list
            // We use contains to match the country code within the comma-separated string
            // Note: This will match the code anywhere in the string, so ensure codes are unique enough
            if (aSelectedCountries.length > 0) {
                const aCountryFilters = aSelectedCountries.map((sCountry) => {
                    // Match country code in comma-separated list using contains
                    // This will match: "RO" in "RO,PL,DK", ",RO," in ",RO,PL,", etc.
                    return new Filter("CountryList", FilterOperator.Contains, sCountry);
                });
                
                if (aCountryFilters.length > 0) {
                    // Create OR filter for all selected countries
                    const oCountryOrFilter = new Filter({
                        filters: aCountryFilters,
                        and: false
                    });
                    mBindingParams.filters.push(oCountryOrFilter);
                }
            }

            // Build OR filter for company codes
            if (aSelectedCompanyCodes.length > 0) {
                const aCompanyCodeFilters = aSelectedCompanyCodes.map((sCompanyCode) => {
                    // Match company code in comma-separated list using contains
                    return new Filter("CompanyCodeList", FilterOperator.Contains, sCompanyCode);
                });
                
                if (aCompanyCodeFilters.length > 0) {
                    // Create OR filter for all selected company codes
                    const oCompanyCodeOrFilter = new Filter({
                        filters: aCompanyCodeFilters,
                        and: false
                    });
                    mBindingParams.filters.push(oCompanyCodeOrFilter);
                }
            }

            // Add default sorter
            if (mBindingParams.sorter) {
                mBindingParams.sorter.push(new Sorter("ConvCreatedAt", true));
            }
        },

        /**
         * Handler for selection change
         */
        onSelectReconciliation: function() {
            const oTable = this.byId("reconcilesTable");
            const oItem = oTable ? oTable.getSelectedItem() : null;
            let bDeleteEnabled = false;
            
            if (oItem) {
                const oReconciliation = oItem.getBindingContext().getObject();
                if (oReconciliation) {
                    bDeleteEnabled = true;
                }
            }
            
            this.getView().getModel("view").setProperty("/reconciliationList/bDeleteEnabled", bDeleteEnabled);
        },

        /**
         * Handler for delete button
         */
        onDeleteReconciliation: function() {
            const oTable = this.byId("reconcilesTable");
            const oItem = oTable ? oTable.getSelectedItem() : null;
            
            if (!oItem) {
                return;
            }

            const oReconciliation = oItem.getBindingContext().getObject();
            const oModel = this.getModel();
            const sPath = oItem.getBindingContext().getPath();

            MessageBox.warning(this.i18n("reconciliationList.DeleteReconciliationWarning"), {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.YES) {
                        this.getView().setBusy(true);
                        try {
                            await oModel.remove(sPath);
                            this._refreshView();
                            MessageToast.show(this.i18n("reconciliationList.DeleteReconciliationConfirmation"));
                            
                            this.onSelectReconciliation();
                            this.getView().setBusy(false);
                            this.getView().getModel("view").setProperty("/reconciliationList/bEditMode", false);
                            this.getView().getModel("view").setProperty("/reconciliationList/bDeleteEnabled", false);
                        } catch (oError) {
                            this.getView().setBusy(false);
                            this.showErrorMessage(oError);
                        }
                    }
                }
            });
        },

        /**
         * Handler for assigned filters changed
         */
        onAssignedFiltersChanged: function() {
            // Can be used to react to filter changes if needed
        },

        /**
         * Handler for view details button
         */
        onViewReconciliationDetails: function(oEvent) {
            const oReconciliation = oEvent.getSource().getBindingContext().getObject();
            // TODO: Navigate to detail view
            MessageToast.show(this.i18n("reconciliationList.ViewDetails"));
        },

        /**
         * Handler for country value help request
         */
        onCountryValueHelpRequest: function(oEvent) {
            const oVHD = this.getView().byId("countryValueHelpDialog");
            const oMultiInput = this.byId("countryListFilter");
            const oModel = this.getModel();
            
            if (!oVHD || !oModel) {
                return;
            }

            // Set tokens from MultiInput
            oVHD.setTokens(oMultiInput.getTokens());
            
            // Get table and set up binding
            oVHD.getTableAsync().then((oTable) => {
                oTable.setModel(oModel);
                
                // For Desktop - sap.ui.table.Table
                if (oTable.bindRows) {
                    oTable.bindAggregation("rows", {
                        path: "/Country",
                        events: {
                            dataReceived: () => {
                                oVHD.update();
                            }
                        }
                    });
                    
                    // Add columns if not already added
                    if (oTable.getColumns().length === 0) {
                        const oColumnCountry = new UITableColumn({
                            label: new Label({text: this.i18n("reconciliationList.CountryList")}),
                            template: new Text({text: "{Country}"})
                        });
                        oColumnCountry.data("fieldName", "Country");
                        
                        const oColumnName = new UITableColumn({
                            label: new Label({text: this.i18n("reconciliationList.CountryName")}),
                            template: new Text({text: "{Country_Text}"})
                        });
                        oColumnName.data("fieldName", "Country_Text");
                        
                        oTable.addColumn(oColumnCountry);
                        oTable.addColumn(oColumnName);
                    }
                }
                
                // For Mobile - sap.m.Table
                if (oTable.bindItems) {
                    oTable.bindAggregation("items", {
                        path: "/Country",
                        template: new ColumnListItem({
                            cells: [
                                new Label({text: "{Country}"}),
                                new Label({text: "{Country_Text}"})
                            ]
                        }),
                        events: {
                            dataReceived: () => {
                                oVHD.update();
                            }
                        }
                    });
                    
                    if (oTable.getColumns().length === 0) {
                        oTable.addColumn(new MColumn({header: new Label({text: this.i18n("reconciliationList.CountryList")})}));
                        oTable.addColumn(new MColumn({header: new Label({text: this.i18n("reconciliationList.CountryName")})}));
                    }
                }
                
                oVHD.update();
            });
            
            oVHD.open();
        },

        /**
         * Handler for country value help OK
         */
        onCountryValueHelpOk: function(oEvent) {
            const aTokens = oEvent.getParameter("tokens");
            const oMultiInput = this.byId("countryListFilter");
            const oViewModel = this.getView().getModel("view");
            const oVHD = this.getView().byId("countryValueHelpDialog");
            
            oMultiInput.setTokens(aTokens);
            
            // Extract selected country codes from tokens
            const aSelectedCountries = aTokens.map((oToken) => oToken.getKey());
            oViewModel.setProperty("/filters/selectedCountries", aSelectedCountries);
            
            // Close the dialog
            if (oVHD) {
                oVHD.close();
            }
            
            // Trigger filter refresh
            const oSmartFilterBar = this.getView().byId("smartFilterBar");
            if (oSmartFilterBar) {
                oSmartFilterBar.fireSearch();
            }
        },

        /**
         * Handler for country value help cancel
         */
        onCountryValueHelpCancel: function() {
            const oVHD = this.getView().byId("countryValueHelpDialog");
            oVHD.close();
        },

        /**
         * Handler for country value help after close
         */
        onCountryValueHelpAfterClose: function() {
            // Cleanup if needed
        },

        /**
         * Handler for company code value help request
         */
        onCompanyCodeValueHelpRequest: function(oEvent) {
            const oVHD = this.getView().byId("companyCodeValueHelpDialog");
            const oMultiInput = this.byId("companyCodeListFilter");
            const oModel = this.getModel();
            
            if (!oVHD || !oModel) {
                return;
            }

            // Set tokens from MultiInput
            oVHD.setTokens(oMultiInput.getTokens());
            
            // Get table and set up binding
            oVHD.getTableAsync().then((oTable) => {
                oTable.setModel(oModel);
                
                // For Desktop - sap.ui.table.Table
                if (oTable.bindRows) {
                    oTable.bindAggregation("rows", {
                        path: "/CompanyVH",
                        events: {
                            dataReceived: () => {
                                oVHD.update();
                            }
                        }
                    });
                    
                    // Add columns if not already added
                    if (oTable.getColumns().length === 0) {
                        const oColumnCode = new UITableColumn({
                            label: new Label({text: this.i18n("reconciliationList.CompanyCodeList")}),
                            template: new Text({text: "{CompanyCode}"})
                        });
                        oColumnCode.data("fieldName", "CompanyCode");
                        
                        const oColumnName = new UITableColumn({
                            label: new Label({text: this.i18n("reconciliationList.CompanyName")}),
                            template: new Text({text: "{Name}"})
                        });
                        oColumnName.data("fieldName", "Name");
                        
                        oTable.addColumn(oColumnCode);
                        oTable.addColumn(oColumnName);
                    }
                }
                
                // For Mobile - sap.m.Table
                if (oTable.bindItems) {
                    oTable.bindAggregation("items", {
                        path: "/CompanyVH",
                        template: new ColumnListItem({
                            cells: [
                                new Label({text: "{CompanyCode}"}),
                                new Label({text: "{Name}"})
                            ]
                        }),
                        events: {
                            dataReceived: () => {
                                oVHD.update();
                            }
                        }
                    });
                    
                    if (oTable.getColumns().length === 0) {
                        oTable.addColumn(new MColumn({header: new Label({text: this.i18n("reconciliationList.CompanyCodeList")})}));
                        oTable.addColumn(new MColumn({header: new Label({text: this.i18n("reconciliationList.CompanyName")})}));
                    }
                }
                
                oVHD.update();
            });
            
            oVHD.open();
        },

        /**
         * Handler for company code value help OK
         */
        onCompanyCodeValueHelpOk: function(oEvent) {
            const aTokens = oEvent.getParameter("tokens");
            const oMultiInput = this.byId("companyCodeListFilter");
            const oViewModel = this.getView().getModel("view");
            const oVHD = this.getView().byId("companyCodeValueHelpDialog");
            
            oMultiInput.setTokens(aTokens);
            
            // Extract selected company codes from tokens
            const aSelectedCompanyCodes = aTokens.map((oToken) => oToken.getKey());
            oViewModel.setProperty("/filters/selectedCompanyCodes", aSelectedCompanyCodes);
            
            // Close the dialog
            if (oVHD) {
                oVHD.close();
            }
            
            // Trigger filter refresh
            const oSmartFilterBar = this.getView().byId("smartFilterBar");
            if (oSmartFilterBar) {
                oSmartFilterBar.fireSearch();
            }
        },

        /**
         * Handler for company code value help cancel
         */
        onCompanyCodeValueHelpCancel: function() {
            const oVHD = this.getView().byId("companyCodeValueHelpDialog");
            oVHD.close();
        },

        /**
         * Handler for company code value help after close
         */
        onCompanyCodeValueHelpAfterClose: function() {
            // Cleanup if needed
        },

        /**
         * Refresh tokenizers in table rows with updated country/company code maps
         * This is called after country/company code maps are loaded to update
         * tokenizers that were populated before the maps were ready
         */
        _refreshTableTokenizers: function() {
            console.log("[_refreshTableTokenizers] Refreshing table tokenizers");
            const oTable = this.getView().byId("reconcilesTable");
            if (!oTable) {
                console.log("[_refreshTableTokenizers] Table not found");
                return;
            }

            const aItems = oTable.getItems();
            if (!aItems || aItems.length === 0) {
                console.log("[_refreshTableTokenizers] No table items found");
                return;
            }

            console.log("[_refreshTableTokenizers] Refreshing", aItems.length, "table rows");
            aItems.forEach((oItem, iIndex) => {
                const oContext = oItem.getBindingContext();
                if (!oContext) {
                    return;
                }

                const oData = oContext.getObject();
                const aCells = oItem.getCells();
                
                // Update country list tokenizer (first cell)
                if (aCells && aCells.length > 0) {
                    const oCountryTokenizer = aCells[0];
                    if (oCountryTokenizer && 
                        oCountryTokenizer.isA && 
                        oCountryTokenizer.isA("sap.m.Tokenizer") &&
                        typeof oCountryTokenizer.removeAllTokens === "function") {
                        oCountryTokenizer.removeAllTokens();
                        const aCountryTokens = this.formatter.formatCountryListToTokens(oData.CountryList);
                        console.log(`[_refreshTableTokenizers] Row ${iIndex}: Refreshing ${aCountryTokens.length} country tokens`);
                        aCountryTokens.forEach((oToken) => {
                            if (oToken && typeof oCountryTokenizer.addToken === "function") {
                                oCountryTokenizer.addToken(oToken);
                            }
                        });
                    }
                }

                // Update company code list tokenizer (second cell)
                if (aCells && aCells.length > 1) {
                    const oCompanyCodeTokenizer = aCells[1];
                    if (oCompanyCodeTokenizer && 
                        oCompanyCodeTokenizer.isA && 
                        oCompanyCodeTokenizer.isA("sap.m.Tokenizer") &&
                        typeof oCompanyCodeTokenizer.removeAllTokens === "function") {
                        oCompanyCodeTokenizer.removeAllTokens();
                        const aCompanyCodeTokens = this.formatter.formatCompanyCodeListToTokens(oData.CompanyCodeList);
                        console.log(`[_refreshTableTokenizers] Row ${iIndex}: Refreshing ${aCompanyCodeTokens.length} company code tokens`);
                        aCompanyCodeTokens.forEach((oToken) => {
                            if (oToken && typeof oCompanyCodeTokenizer.addToken === "function") {
                                oCompanyCodeTokenizer.addToken(oToken);
                            }
                        });
                    }
                }
            });
        },

        /**
         * Handler for table data received - populate tokenizers
         * Note: setTokens() exists on ValueHelpDialog, but for Tokenizer controls
         * we must use removeAllTokens() and addToken() methods
         */
        _onTableDataReceived: function() {
            console.log("[_onTableDataReceived] Table data received, populating tokenizers");
            const oTable = this.getView().byId("reconcilesTable");
            if (!oTable) {
                return;
            }

            const aItems = oTable.getItems();
            console.log("[_onTableDataReceived] Processing", aItems ? aItems.length : 0, "table items");
            aItems.forEach((oItem) => {
                const oContext = oItem.getBindingContext();
                if (!oContext) {
                    return;
                }

                const oData = oContext.getObject();
                const aCells = oItem.getCells();
                
                // Update country list tokenizer (first cell)
                if (aCells && aCells.length > 0) {
                    const oCountryTokenizer = aCells[0];
                    if (oCountryTokenizer && 
                        oCountryTokenizer.isA && 
                        oCountryTokenizer.isA("sap.m.Tokenizer") &&
                        typeof oCountryTokenizer.removeAllTokens === "function") {
                        oCountryTokenizer.removeAllTokens();
                        const aCountryTokens = this.formatter.formatCountryListToTokens(oData.CountryList);
                        console.log("[_onTableDataReceived] Country tokens created:", aCountryTokens.length, "CountryList:", oData.CountryList);
                        aCountryTokens.forEach((oToken) => {
                            if (oToken && typeof oCountryTokenizer.addToken === "function") {
                                oCountryTokenizer.addToken(oToken);
                            }
                        });
                    }
                }

                // Update company code list tokenizer (second cell)
                if (aCells && aCells.length > 1) {
                    const oCompanyCodeTokenizer = aCells[1];
                    if (oCompanyCodeTokenizer && 
                        oCompanyCodeTokenizer.isA && 
                        oCompanyCodeTokenizer.isA("sap.m.Tokenizer") &&
                        typeof oCompanyCodeTokenizer.removeAllTokens === "function") {
                        oCompanyCodeTokenizer.removeAllTokens();
                        const aCompanyCodeTokens = this.formatter.formatCompanyCodeListToTokens(oData.CompanyCodeList);
                        console.log("[_onTableDataReceived] Company code tokens created:", aCompanyCodeTokens.length, "CompanyCodeList:", oData.CompanyCodeList);
                        aCompanyCodeTokens.forEach((oToken) => {
                            if (oToken && typeof oCompanyCodeTokenizer.addToken === "function") {
                                oCompanyCodeTokenizer.addToken(oToken);
                            }
                        });
                    }
                }
            });
        }
    });

    return MainController;
});