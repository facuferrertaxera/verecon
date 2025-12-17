sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Sorter",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "tech/taxera/taxreporting/verecon/utils/types",
    "tech/taxera/taxreporting/verecon/utils/formatter"
], (Controller, Sorter, MessageToast, MessageBox, Filter, FilterOperator, JSONModel, types, formatter) => {
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

            // Attach route matched handler if routing is available
            const oRouter = this.getOwnerComponent().getRouter();
            if (oRouter) {
                const oRoute = oRouter.getRoute("RouteMain");
                if (oRoute) {
                    oRoute.attachMatched(this._onReconciliationListMatched, this);
                }
            }
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
            const oDialog = this.getView().byId("countryValueHelpDialog");
            const oViewModel = this.getView().getModel("view");
            const aSelectedCountries = oViewModel.getProperty("/filters/selectedCountries") || [];
            
            // Update selection state in available countries
            const aAvailableCountries = oViewModel.getProperty("/filters/availableCountries") || [];
            aAvailableCountries.forEach((oCountry) => {
                oCountry.selected = aSelectedCountries.includes(oCountry.code);
            });
            oViewModel.setProperty("/filters/availableCountries", aAvailableCountries);
            
            oDialog.open();
        },

        /**
         * Handler for country value help confirm
         */
        onCountryValueHelpConfirm: function() {
            const oDialog = this.getView().byId("countryValueHelpDialog");
            const oList = this.getView().byId("countryList");
            const oViewModel = this.getView().getModel("view");
            
            // Get selected items
            const aSelectedItems = oList.getSelectedItems();
            const aSelectedCountries = aSelectedItems.map((oItem) => {
                return oItem.getBindingContext("view").getObject().code;
            });
            
            // Update view model
            oViewModel.setProperty("/filters/selectedCountries", aSelectedCountries);
            oViewModel.setProperty("/filters/selectedCountriesDisplay", aSelectedCountries.join(", ") || "");
            
            // Close dialog
            oDialog.close();
            
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
            const oDialog = this.getView().byId("countryValueHelpDialog");
            oDialog.close();
        },

        /**
         * Handler for company code value help request
         */
        onCompanyCodeValueHelpRequest: function(oEvent) {
            const oDialog = this.getView().byId("companyCodeValueHelpDialog");
            const oViewModel = this.getView().getModel("view");
            const aSelectedCompanyCodes = oViewModel.getProperty("/filters/selectedCompanyCodes") || [];
            
            // Update selection state in available company codes
            const aAvailableCompanyCodes = oViewModel.getProperty("/filters/availableCompanyCodes") || [];
            aAvailableCompanyCodes.forEach((oCompanyCode) => {
                oCompanyCode.selected = aSelectedCompanyCodes.includes(oCompanyCode.code);
            });
            oViewModel.setProperty("/filters/availableCompanyCodes", aAvailableCompanyCodes);
            
            oDialog.open();
        },

        /**
         * Handler for company code value help confirm
         */
        onCompanyCodeValueHelpConfirm: function() {
            const oDialog = this.getView().byId("companyCodeValueHelpDialog");
            const oList = this.getView().byId("companyCodeList");
            const oViewModel = this.getView().getModel("view");
            
            // Get selected items
            const aSelectedItems = oList.getSelectedItems();
            const aSelectedCompanyCodes = aSelectedItems.map((oItem) => {
                return oItem.getBindingContext("view").getObject().code;
            });
            
            // Update view model
            oViewModel.setProperty("/filters/selectedCompanyCodes", aSelectedCompanyCodes);
            oViewModel.setProperty("/filters/selectedCompanyCodesDisplay", aSelectedCompanyCodes.join(", ") || "");
            
            // Close dialog
            oDialog.close();
            
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
            const oDialog = this.getView().byId("companyCodeValueHelpDialog");
            oDialog.close();
        }
    });

    return MainController;
});