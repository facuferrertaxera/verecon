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

                    // Update view model
                    this.getView().getModel("view").setProperty("/filters/availableCountries", aCountries);
                },
                error: (oError) => {
                    // If error loading, fall back to empty array or show error
                    console.error("Error loading countries:", oError);
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

                    // Update view model
                    this.getView().getModel("view").setProperty("/filters/availableCompanyCodes", aCompanyCodes);
                },
                error: (oError) => {
                    // If error loading, fall back to empty array or show error
                    console.error("Error loading company codes:", oError);
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
            const oModel = this.getModel();
            if (oModel && oModel.hasPendingChanges && oModel.hasPendingChanges(true)) {
                oModel.resetChanges();
            }
            
            // Load countries and company codes from service
            // This happens here because OData model metadata may not be ready in onInit
            this._loadAvailableCountries();
            this._loadAvailableCompanyCodes();
            
            // Ensure custom filter controls are visible
            this._ensureFilterControlsVisible();
            
            this._refreshView();
        },

        /**
         * Ensure custom filter controls are visible in SmartFilterBar
         */
        _ensureFilterControlsVisible: function() {
            const oSmartFilterBar = this.getView().byId("smartFilterBar");
            if (oSmartFilterBar) {
                // Use multiple timeouts to ensure SmartFilterBar is fully initialized
                setTimeout(() => {
                    try {
                        // Get the filter items and ensure CountryList and CompanyCodeList are visible
                        const aFilterItems = oSmartFilterBar.getFilterItems();
                        aFilterItems.forEach((oFilterItem) => {
                            const sName = oFilterItem.getName();
                            if (sName === "CountryList" || sName === "CompanyCodeList") {
                                oFilterItem.setVisible(true);
                                oFilterItem.setVisibleInAdvancedArea(false);
                                // Ensure the control itself is visible
                                const oControl = oFilterItem.getControl();
                                if (oControl) {
                                    oControl.setVisible(true);
                                }
                            }
                        });
                        
                        // Also try to show the basic filter area
                        if (oSmartFilterBar.setFilterBarExpanded) {
                            oSmartFilterBar.setFilterBarExpanded(true);
                        }
                    } catch (oError) {
                        console.warn("Error ensuring filter controls visible:", oError);
                    }
                }, 200);
                
                // Try again after a longer delay to catch late initialization
                setTimeout(() => {
                    try {
                        const aFilterItems = oSmartFilterBar.getFilterItems();
                        aFilterItems.forEach((oFilterItem) => {
                            const sName = oFilterItem.getName();
                            if (sName === "CountryList" || sName === "CompanyCodeList") {
                                oFilterItem.setVisible(true);
                                oFilterItem.setVisibleInAdvancedArea(false);
                            }
                        });
                    } catch (oError) {
                        // Ignore errors on second attempt
                    }
                }, 500);
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
         * Handler for table data received - populate tokenizers
         */
        _onTableDataReceived: function() {
            const oTable = this.getView().byId("reconcilesTable");
            if (!oTable) {
                return;
            }

            const aItems = oTable.getItems();
            aItems.forEach((oItem) => {
                const oContext = oItem.getBindingContext();
                if (!oContext) {
                    return;
                }

                const oData = oContext.getObject();
                
                // Update country list tokenizer
                const aCells = oItem.getCells();
                if (aCells && aCells.length > 0) {
                    const oCountryCell = aCells[0];
                    // Check if it's a Tokenizer or find Tokenizer within the cell
                    let oCountryTokenizer = null;
                    if (oCountryCell && oCountryCell.isA && oCountryCell.isA("sap.m.Tokenizer")) {
                        oCountryTokenizer = oCountryCell;
                    } else if (oCountryCell && oCountryCell.getContent && oCountryCell.getContent) {
                        // If cell is a container, find Tokenizer inside
                        const aContent = oCountryCell.getContent();
                        oCountryTokenizer = aContent && aContent.find ? aContent.find(c => c.isA && c.isA("sap.m.Tokenizer")) : null;
                    }
                    
                    if (oCountryTokenizer && typeof oCountryTokenizer.removeAllTokens === "function") {
                        oCountryTokenizer.removeAllTokens();
                        const aCountryTokens = this.formatter.formatCountryListToTokens(oData.CountryList);
                        aCountryTokens.forEach((oToken) => {
                            if (oToken && typeof oCountryTokenizer.addToken === "function") {
                                oCountryTokenizer.addToken(oToken);
                            }
                        });
                    }
                }

                // Update company code list tokenizer
                if (aCells && aCells.length > 1) {
                    const oCompanyCodeCell = aCells[1];
                    // Check if it's a Tokenizer or find Tokenizer within the cell
                    let oCompanyCodeTokenizer = null;
                    if (oCompanyCodeCell && oCompanyCodeCell.isA && oCompanyCodeCell.isA("sap.m.Tokenizer")) {
                        oCompanyCodeTokenizer = oCompanyCodeCell;
                    } else if (oCompanyCodeCell && oCompanyCodeCell.getContent && oCompanyCodeCell.getContent) {
                        // If cell is a container, find Tokenizer inside
                        const aContent = oCompanyCodeCell.getContent();
                        oCompanyCodeTokenizer = aContent && aContent.find ? aContent.find(c => c.isA && c.isA("sap.m.Tokenizer")) : null;
                    }
                    
                    if (oCompanyCodeTokenizer && typeof oCompanyCodeTokenizer.removeAllTokens === "function") {
                        oCompanyCodeTokenizer.removeAllTokens();
                        const aCompanyCodeTokens = this.formatter.formatCompanyCodeListToTokens(oData.CompanyCodeList);
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