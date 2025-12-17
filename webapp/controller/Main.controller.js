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

            // Initialize country, company code, and status maps
            this._mCountryMap = {};
            this._mCompanyCodeMap = {};
            this._mStatusMap = {};

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
         * Load available statuses from xTAXERAxI_SF_STATUS_VH entity set
         */
        _loadAvailableStatuses: function() {
            const oModel = this.getModel();
            if (!oModel) {
                return;
            }

            // Read statuses from xTAXERAxI_SF_STATUS_VH entity set
            oModel.read("/xTAXERAxI_SF_STATUS_VH", {
                urlParameters: {
                    "$select": "Status,Description,value_position"
                },
                sorters: [
                    new Sorter("value_position", false)
                ],
                success: (oResponse) => {
                    // OData v2 uses results array
                    const aResults = oResponse.results || [];
                    
                    // Create status code to description mapping for formatter
                    this._mStatusMap = {};
                    aResults.forEach((oStatus) => {
                        this._mStatusMap[oStatus.Status] = {
                            description: oStatus.Description || oStatus.Status,
                            status: oStatus.Status
                        };
                    });

                    console.log("[_loadAvailableStatuses] Status map populated with", Object.keys(this._mStatusMap).length, "statuses");
                },
                error: (oError) => {
                    console.error("[_loadAvailableStatuses] Error loading statuses:", oError);
                    this._mStatusMap = {};
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
            
            // Load countries, company codes, and statuses from service
            // This happens here because OData model metadata may not be ready in onInit
            console.log("[_onReconciliationListMatched] Loading countries, company codes, and statuses");
            this._loadAvailableCountries();
            this._loadAvailableCompanyCodes();
            this._loadAvailableStatuses();
            
            // Note: Filter controls visibility is handled in _onSmartFilterBarInitialized event
            // which fires after SmartFilterBar is fully initialized
            
            console.log("[_onReconciliationListMatched] Refreshing view");
            this._refreshView();
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