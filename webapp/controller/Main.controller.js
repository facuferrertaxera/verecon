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
    "tech/taxera/taxreporting/verecon/utils/formatter",
    "tech/taxera/taxreporting/verecon/controller/main/newReconciliation"
], (Controller, Sorter, MessageToast, MessageBox, Filter, FilterOperator, JSONModel, ValueHelpDialog, UITableColumn, MColumn, Text, Label, ColumnListItem, SearchField, Token, types, formatter, newReconciliation) => {
    "use strict";

    // Mix in newReconciliation methods
    const MainController = Controller.extend("tech.taxera.taxreporting.verecon.controller.Main", Object.assign({
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

            // Get maps from component (they should already be loading or loaded)
            const oComponent = this.getOwnerComponent();
            if (oComponent) {
                // Reference component maps for backward compatibility
                this._mCountryMap = oComponent._mCountryMap || {};
                this._mCompanyCodeMap = oComponent._mCompanyCodeMap || {};
                this._mStatusMap = oComponent._mStatusMap || {};
            } else {
                // Fallback if component not available
                this._mCountryMap = {};
                this._mCompanyCodeMap = {};
                this._mStatusMap = {};
            }

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
         * Helper to wrap OData model.read() in a Promise
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - OData model
         * @param {string} sPath - Entity path
         * @param {object} mParameters - Read parameters (urlParameters, sorters, etc.)
         * @returns {Promise} Promise that resolves with response or rejects with error
         */
        _readOData: function(oModel, sPath, mParameters) {
            return new Promise((resolve, reject) => {
                const mReadParams = {
                    success: resolve,
                    error: reject
                };
                
                // Copy parameters (urlParameters, sorters, etc.) to read params
                if (mParameters) {
                    Object.keys(mParameters).forEach((sKey) => {
                        if (sKey !== "success" && sKey !== "error") {
                            mReadParams[sKey] = mParameters[sKey];
                        }
                    });
                }
                
                oModel.read(sPath, mReadParams);
            });
        },

        /**
         * Load available countries for filter dropdown
         * Note: Maps are loaded in Component.js, this only loads the array for filters
         * @returns {Promise} Promise that resolves when countries are loaded
         */
        _loadAvailableCountriesForFilters: async function() {
            const oModel = this.getModel();
            if (!oModel) {
                return;
            }

            try {
                // Read countries from Country entity set
                // For OData v2, response is in oResponse.results
                const oResponse = await this._readOData(oModel, "/Country", {
                    urlParameters: {
                        "$select": "Country,Country_Text,CountryName"
                    },
                    sorters: [
                        new Sorter("Country", false)
                    ]
                });

                // OData v2 uses results array
                const aResults = oResponse.results || [];
                const aCountries = aResults.map((oCountry) => {
                    return {
                        code: oCountry.Country,
                        name: oCountry.Country_Text || oCountry.CountryName || oCountry.Country,
                        selected: false
                    };
                });

                console.log("[_loadAvailableCountriesForFilters] Loaded", aCountries.length, "countries for filters");

                // Update view model
                this.getView().getModel("view").setProperty("/filters/availableCountries", aCountries);
            } catch (oError) {
                // If error loading, fall back to empty array or show error
                console.error("[_loadAvailableCountriesForFilters] Error loading countries:", oError);
                this.getView().getModel("view").setProperty("/filters/availableCountries", []);
            }
        },

        /**
         * Load available company codes for filter dropdown
         * Note: Maps are loaded in Component.js, this only loads the array for filters
         * @returns {Promise} Promise that resolves when company codes are loaded
         */
        _loadAvailableCompanyCodesForFilters: async function() {
            const oModel = this.getModel();
            if (!oModel) {
                return;
            }

            try {
                // Read company codes from CompanyVH entity set
                // For OData v2, response is in oResponse.results
                const oResponse = await this._readOData(oModel, "/CompanyVH", {
                    urlParameters: {
                        "$select": "CompanyCode,Name,Country,CountryName"
                    },
                    sorters: [
                        new Sorter("CompanyCode", false)
                    ]
                });

                // OData v2 uses results array
                const aResults = oResponse.results || [];
                const aCompanyCodes = aResults.map((oCompany) => {
                    return {
                        code: oCompany.CompanyCode,
                        name: oCompany.Name || oCompany.CompanyCode,
                        selected: false
                    };
                });

                console.log("[_loadAvailableCompanyCodesForFilters] Loaded", aCompanyCodes.length, "company codes for filters");

                // Update view model
                this.getView().getModel("view").setProperty("/filters/availableCompanyCodes", aCompanyCodes);
            } catch (oError) {
                // If error loading, fall back to empty array or show error
                console.error("[_loadAvailableCompanyCodesForFilters] Error loading company codes:", oError);
                this.getView().getModel("view").setProperty("/filters/availableCompanyCodes", []);
            }
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
        _onReconciliationListMatched: async function() {
            console.log("[_onReconciliationListMatched] Route matched");
            const oModel = this.getModel();
            if (oModel && oModel.hasPendingChanges && oModel.hasPendingChanges(true)) {
                console.log("[_onReconciliationListMatched] Resetting pending changes");
                oModel.resetChanges();
            }
            
            // Wait for component maps to be ready (they're loaded in Component.js)
            const oComponent = this.getOwnerComponent();
            if (oComponent && oComponent.getMapsReadyPromise) {
                console.log("[_onReconciliationListMatched] Waiting for component maps to be ready...");
                try {
                    await oComponent.getMapsReadyPromise();
                    // Update local references to component maps
                    this._mCountryMap = oComponent._mCountryMap || {};
                    this._mCompanyCodeMap = oComponent._mCompanyCodeMap || {};
                    this._mStatusMap = oComponent._mStatusMap || {};
                    console.log("[_onReconciliationListMatched] Component maps ready");
                } catch (oError) {
                    console.error("[_onReconciliationListMatched] Error waiting for maps:", oError);
                }
            }
            
            // Load available countries and company codes for filter dropdowns
            // (maps are already loaded in component, but we need the arrays for filters)
            this._loadAvailableCountriesForFilters();
            this._loadAvailableCompanyCodesForFilters();
            
            // Note: Filter controls visibility is handled in _onSmartFilterBarInitialized event
            // which fires after SmartFilterBar is fully initialized
            
            console.log("[_onReconciliationListMatched] Refreshing view");
            this._refreshView();
            
            // After refreshing, wait a bit for table data to load, then refresh tokenizers
            // This handles the case where table data arrives after maps are ready
            setTimeout(() => {
                this._refreshTableTokenizers();
            }, 100);
        },
        /**
         * Refresh the view
         */
        _refreshView: function() {
            const oTable = this.getView().byId("reconcilesTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
                // Also try to populate tokenizers after refresh
                // Use a longer delay to ensure data is loaded
                setTimeout(() => {
                    this._populateTableTokenizers();
                }, 500);
            }
        },

        /**
         * Handler for Create button - opens new reconciliation dialog
         */
        onReconciliationCreate: function() {
            return newReconciliation.openNewReconciliation.call(this);
        },

        /**
         * Handler for row press
         */
        onReconciliationPress: function(oEvent) {
            const oReconciliation = oEvent.getSource().getBindingContext().getObject();
            const sReconId = oReconciliation.Id;
            
            if (sReconId) {
                this.getRouter().navTo("ReconciliationDetail", {
                    reconId: sReconId
                });
            } else {
                MessageToast.show(this.i18n("reconciliationList.NavigateToDetailError"));
            }
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

            // Clear existing tokens first by setting empty array, then set new tokens
            // This prevents duplication when opening the dialog multiple times
            oVHD.setTokens([]);
            
            // Clone tokens from MultiInput to avoid reference issues
            const aTokens = oMultiInput.getTokens();
            const aClonedTokens = aTokens.map((oToken) => {
                return new Token({
                    key: oToken.getKey(),
                    text: oToken.getText()
                });
            });
            oVHD.setTokens(aClonedTokens);
            
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

            // Clear existing tokens first by setting empty array, then set new tokens
            // This prevents duplication when opening the dialog multiple times
            oVHD.setTokens([]);
            
            // Clone tokens from MultiInput to avoid reference issues
            const aTokens = oMultiInput.getTokens();
            const aClonedTokens = aTokens.map((oToken) => {
                return new Token({
                    key: oToken.getKey(),
                    text: oToken.getText()
                });
            });
            oVHD.setTokens(aClonedTokens);
            
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
         * 
         * This method also triggers tokenizer population if table data was received
         * before maps were ready (handles the race condition)
         */
        _refreshTableTokenizers: function() {
            const oTable = this.getView().byId("reconcilesTable");
            if (!oTable) {
                return;
            }

            const aItems = oTable.getItems();
            if (!aItems || aItems.length === 0) {
                // If no items yet, table data might arrive later
                // The _onTableDataReceived handler will populate tokenizers when data arrives
                return;
            }

            // Use the same implementation as _populateTableTokenizers
            this._populateTableTokenizers();
        },

        /**
         * Handler for table data received - populate tokenizers
         * Note: setTokens() exists on ValueHelpDialog, but for Tokenizer controls
         * we must use removeAllTokens() and addToken() methods
         * 
         * This method waits for component maps to be ready before populating tokenizers.
         */
        _onTableDataReceived: async function() {
            console.log("[_onTableDataReceived] Table data received");
            const oTable = this.getView().byId("reconcilesTable");
            if (!oTable) {
                console.log("[_onTableDataReceived] Table not found");
                return;
            }

            // Wait for component maps to be ready
            const oComponent = this.getOwnerComponent();
            if (oComponent && oComponent.getMapsReadyPromise) {
                try {
                    console.log("[_onTableDataReceived] Waiting for component maps to be ready...");
                    await oComponent.getMapsReadyPromise();
                    // Update local references to component maps
                    this._mCountryMap = oComponent._mCountryMap || {};
                    this._mCompanyCodeMap = oComponent._mCompanyCodeMap || {};
                    this._mStatusMap = oComponent._mStatusMap || {};
                    console.log("[_onTableDataReceived] Component maps ready");
                } catch (oError) {
                    console.error("[_onTableDataReceived] Error waiting for maps:", oError);
                    // Continue anyway - maps might be partially loaded
                }
            } else {
                console.log("[_onTableDataReceived] No component maps promise found, proceeding anyway");
            }

            // Maps are ready (or promise resolved), populate tokenizers
            console.log("[_onTableDataReceived] Populating tokenizers");
            this._populateTableTokenizers();
        },

        /**
         * Populate tokenizers in table rows
         * This is the actual implementation that populates tokenizers
         * Separated from _onTableDataReceived to allow calling after maps are ready
         */
        _populateTableTokenizers: function() {
            const oTable = this.getView().byId("reconcilesTable");
            if (!oTable) {
                console.log("[_populateTableTokenizers] Table not found");
                return;
            }

            const aItems = oTable.getItems();
            console.log("[_populateTableTokenizers] Found", aItems ? aItems.length : 0, "table items");
            
            if (!aItems || aItems.length === 0) {
                console.log("[_populateTableTokenizers] No items to populate");
                return;
            }
            
            let iTokenizersPopulated = 0;
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
                        console.log("[_populateTableTokenizers] Country tokens for row:", aCountryTokens.length, "tokens from", oData.CountryList);
                        aCountryTokens.forEach((oToken) => {
                            if (oToken && typeof oCountryTokenizer.addToken === "function") {
                                oCountryTokenizer.addToken(oToken);
                                iTokenizersPopulated++;
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
                        console.log("[_populateTableTokenizers] Company code tokens for row:", aCompanyCodeTokens.length, "tokens from", oData.CompanyCodeList);
                        aCompanyCodeTokens.forEach((oToken) => {
                            if (oToken && typeof oCompanyCodeTokenizer.addToken === "function") {
                                oCompanyCodeTokenizer.addToken(oToken);
                                iTokenizersPopulated++;
                            }
                        });
                    }
                }
            });
            
            console.log("[_populateTableTokenizers] Populated", iTokenizersPopulated, "tokens across", aItems.length, "rows");
        }
    }, newReconciliation));

    return MainController;
});