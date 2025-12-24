sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/ui/core/library",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/table/Column",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/ColumnListItem",
    "sap/m/Token"
], function (Fragment, library, MessageBox, MessageToast, Filter, FilterOperator, UITableColumn, MColumn, Text, Label, ColumnListItem, Token) {
    "use strict";

    return {
        /**
         * Opens the Reconciliation dialog
         */
        openNewReconciliation: async function () {
            const oView = this.getView();
            const oReconciliationDialog = this.getView().byId("ReconciliationDialog");
            if (!oReconciliationDialog) {
                MessageToast.show("Dialog not found. Please refresh the page.");
                return;
            }
            this.getModel().resetChanges();
            
            const oNewContext = this.getModel().createEntry("/Reconciliation", {
                properties: {
                    Status: "C",
                    StatusText: this.i18n("reconciliationPopup.ReconciliationCreated"),
                    FromDate: null,
                    ToDate: null,
                    CountryList: "",
                    CompanyCodeList: ""
                }
            });

            // Clear inputs
            oView.byId("reconciliationCountryListInput").setTokens([]);
            oView.byId("reconciliationCompanyCodeListInput").setTokens([]);

            // Reset validation states
            this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CountryListValueState", library.ValueState.None);
            this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CountryListValueStateText", "");
            this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CompanyCodeListValueState", library.ValueState.None);
            this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CompanyCodeListValueStateText", "");
            this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/dateRangeValueState", library.ValueState.None);
            this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/dateRangeValueStateText", "");

            oReconciliationDialog.setBindingContext(oNewContext);
            oReconciliationDialog.open();
        },


        /**
         * Handler for cancel button
         */
        onNewReconciliationCancel: function () {
            this.getView().byId("ReconciliationDialog").close();
            this.getModel().resetChanges();
        },

        /**
         * Handler for proceed button - validates and creates reconciliation
         */
        onNewReconciliationProceed: async function () {
            const oView = this.getView();
            const oReconciliationDialog = oView.byId("ReconciliationDialog");
            const oNewContext = oReconciliationDialog.getBindingContext();
            const oNewReconciliation = oNewContext.getObject();
            let bValid = true;

            // Get selected countries and company codes from MultiInput tokens
            const oCountryInput = oView.byId("reconciliationCountryListInput");
            const oCompanyCodeInput = oView.byId("reconciliationCompanyCodeListInput");
            const aCountryTokens = oCountryInput.getTokens();
            const aCompanyCodeTokens = oCompanyCodeInput.getTokens();

            // Build comma-separated lists
            const sCountryList = aCountryTokens.map(oToken => oToken.getKey()).join(",");
            const sCompanyCodeList = aCompanyCodeTokens.map(oToken => oToken.getKey()).join(",");

            // Validation Checks
            if (!sCountryList || aCountryTokens.length === 0) {
                bValid = false;
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CountryListValueState", library.ValueState.Error);
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CountryListValueStateText", this.i18n("reconciliationPopup.CountryListMandatory"));
            } else {
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CountryListValueState", library.ValueState.None);
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CountryListValueStateText", "");
            }

            if (!sCompanyCodeList || aCompanyCodeTokens.length === 0) {
                bValid = false;
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CompanyCodeListValueState", library.ValueState.Error);
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CompanyCodeListValueStateText", this.i18n("reconciliationPopup.CompanyCodeListMandatory"));
            } else {
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CompanyCodeListValueState", library.ValueState.None);
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/CompanyCodeListValueStateText", "");
            }

            if (!oNewReconciliation.FromDate || !oNewReconciliation.ToDate) {
                bValid = false;
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/dateRangeValueState", library.ValueState.Error);
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/dateRangeValueStateText", this.i18n("reconciliationPopup.DateRangeMandatory"));
            } else {
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/dateRangeValueState", library.ValueState.None);
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/dateRangeValueStateText", "");
            }

            if (!bValid) {
                return;
            }

            // Set the country and company code lists
            oNewReconciliation.CountryList = sCountryList;
            oNewReconciliation.CompanyCodeList = sCompanyCodeList;

            try {
                oReconciliationDialog.setBusy(true);
                await this.getModel().submitChanges();
                oReconciliationDialog.close();
                this._refreshView();
                MessageToast.show(this.i18n("reconciliationList.CreateReconciliationConfirmation"));
            } catch (oError) {
                this._handleReconciliationCreateError(oError);
            } finally {
                oReconciliationDialog.setBusy(false);
            }
        },

        /**
         * Handler for date range change
         */
        onReconciliationDateRangeChange: function (oEvent) {
            const oView = this.getView();
            const oReconciliationDialog = oView.byId("ReconciliationDialog");
            const sPath = oReconciliationDialog.getBindingContext().getPath();
            const bValid = oEvent.getParameter("valid");
            const oDateFrom = oEvent.getParameter("from");
            const oDateTo = oEvent.getParameter("to");

            oReconciliationDialog.getModel().setProperty(sPath + "/FromDate", oDateFrom);
            oReconciliationDialog.getModel().setProperty(sPath + "/ToDate", oDateTo);

            if (!bValid) {
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/dateRangeValueState", library.ValueState.Error);
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/dateRangeValueStateText", this.i18n("reconciliationPopup.InvalidDate"));
            } else {
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/dateRangeValueState", library.ValueState.None);
                this.getView().getModel("view").setProperty("/reconciliationList/newReconciliation/dateRangeValueStateText", "");
            }
        },

        /**
         * Handler for reconciliation creation error
         */
        _handleReconciliationCreateError: function (oError) {
            let sMessage = this.i18n("error.generic");
            if (oError && oError.responseText) {
                try {
                    const oErrorData = JSON.parse(oError.responseText);
                    sMessage = oErrorData.error ? oErrorData.error.message.value : sMessage;
                } catch (e) {
                    // If parsing fails, use default message
                }
            }
            MessageBox.error(sMessage);
        },

        /**
         * Handler for country value help request in reconciliation dialog
         */
        onReconciliationCountryValueHelpRequest: function (oEvent) {
            const oView = this.getView();
            const oVHD = oView.byId("reconciliationCountryValueHelpDialog");
            const oMultiInput = oView.byId("reconciliationCountryListInput");
            const oModel = this.getModel();
            
            if (!oVHD || !oModel) {
                return;
            }

            oVHD.setTokens([]);
            const aTokens = oMultiInput.getTokens();
            const aClonedTokens = aTokens.map((oToken) => {
                return new Token({
                    key: oToken.getKey(),
                    text: oToken.getText()
                });
            });
            oVHD.setTokens(aClonedTokens);
            
            oVHD.getTableAsync().then((oTable) => {
                oTable.setModel(oModel);
                
                if (oTable.bindRows) {
                    oTable.bindAggregation("rows", {
                        path: "/Country",
                        events: {
                            dataReceived: () => {
                                oVHD.update();
                            }
                        }
                    });
                    
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
         * Handler for country value help OK in reconciliation dialog
         */
        onReconciliationCountryValueHelpOk: function (oEvent) {
            const oView = this.getView();
            const aTokens = oEvent.getParameter("tokens");
            const oMultiInput = oView.byId("reconciliationCountryListInput");
            const oVHD = oView.byId("reconciliationCountryValueHelpDialog");
            
            oMultiInput.setTokens(aTokens);
            
            if (oVHD) {
                oVHD.close();
            }
        },

        /**
         * Handler for country value help cancel in reconciliation dialog
         */
        onReconciliationCountryValueHelpCancel: function () {
            const oView = this.getView();
            const oVHD = oView.byId("reconciliationCountryValueHelpDialog");
            oVHD.close();
        },

        /**
         * Handler for country value help after close in reconciliation dialog
         */
        onReconciliationCountryValueHelpAfterClose: function () {
            // Cleanup if needed
        },

        /**
         * Handler for company code value help request in reconciliation dialog
         */
        onReconciliationCompanyCodeValueHelpRequest: function (oEvent) {
            const oView = this.getView();
            const oVHD = oView.byId("reconciliationCompanyCodeValueHelpDialog");
            const oMultiInput = oView.byId("reconciliationCompanyCodeListInput");
            const oModel = this.getModel();
            
            if (!oVHD || !oModel) {
                return;
            }

            oVHD.setTokens([]);
            const aTokens = oMultiInput.getTokens();
            const aClonedTokens = aTokens.map((oToken) => {
                return new Token({
                    key: oToken.getKey(),
                    text: oToken.getText()
                });
            });
            oVHD.setTokens(aClonedTokens);
            
            oVHD.getTableAsync().then((oTable) => {
                oTable.setModel(oModel);
                
                if (oTable.bindRows) {
                    oTable.bindAggregation("rows", {
                        path: "/CompanyVH",
                        events: {
                            dataReceived: () => {
                                oVHD.update();
                            }
                        }
                    });
                    
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
         * Handler for company code value help OK in reconciliation dialog
         */
        onReconciliationCompanyCodeValueHelpOk: function (oEvent) {
            const oView = this.getView();
            const aTokens = oEvent.getParameter("tokens");
            const oMultiInput = oView.byId("reconciliationCompanyCodeListInput");
            const oVHD = oView.byId("reconciliationCompanyCodeValueHelpDialog");
            
            oMultiInput.setTokens(aTokens);
            
            if (oVHD) {
                oVHD.close();
            }
        },

        /**
         * Handler for company code value help cancel in reconciliation dialog
         */
        onReconciliationCompanyCodeValueHelpCancel: function () {
            const oView = this.getView();
            const oVHD = oView.byId("reconciliationCompanyCodeValueHelpDialog");
            oVHD.close();
        },

        /**
         * Handler for company code value help after close in reconciliation dialog
         */
        onReconciliationCompanyCodeValueHelpAfterClose: function () {
            // Cleanup if needed
        }
    };
});





