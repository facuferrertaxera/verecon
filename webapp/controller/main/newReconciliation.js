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
            const oRootControl = this.getOwnerComponent().getRootControl();
            const oReconciliationDialog = await this._getNewReconciliationDialog();
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
            oRootControl.byId("reconciliationCountryListInput").setTokens([]);
            oRootControl.byId("reconciliationCompanyCodeListInput").setTokens([]);

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
         * Gets a reference to the Reconciliation Dialog
         * If not yet loaded, it will load the dialog first
         */
        _getNewReconciliationDialog: function () {
            const oRootControl = this.getOwnerComponent().getRootControl();
            const oReconciliationDialog = oRootControl.byId("ReconciliationDialog");
            if (!oReconciliationDialog) {
                return Fragment.load({
                    id: oRootControl.getId(),
                    name: "tech.taxera.taxreporting.verecon.view.main.newReconciliation.newReconciliation",
                    controller: this
                }).then(function (oDialog) {
                    oRootControl.addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            } else {
                return Promise.resolve(oReconciliationDialog);
            }
        },

        /**
         * Handler for cancel button
         */
        onNewReconciliationCancel: function () {
            const oRootControl = this.getOwnerComponent().getRootControl();
            oRootControl.byId("ReconciliationDialog").close();
            this.getModel().resetChanges();
        },

        /**
         * Handler for proceed button - validates and creates reconciliation
         */
        onNewReconciliationProceed: async function () {
            const oRootControl = this.getOwnerComponent().getRootControl();
            const oReconciliationDialog = oRootControl.byId("ReconciliationDialog");
            const oNewContext = oReconciliationDialog.getBindingContext();
            const oNewReconciliation = oNewContext.getObject();
            let bValid = true;

            // Get selected countries and company codes from MultiInput tokens
            const oCountryInput = oRootControl.byId("reconciliationCountryListInput");
            const oCompanyCodeInput = oRootControl.byId("reconciliationCompanyCodeListInput");
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
            const oRootControl = this.getOwnerComponent().getRootControl();
            const oReconciliationDialog = oRootControl.byId("ReconciliationDialog");
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
            const oVHD = this.getOwnerComponent().getRootControl().byId("reconciliationCountryValueHelpDialog");
            const oMultiInput = this.getOwnerComponent().getRootControl().byId("reconciliationCountryListInput");
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
            const aTokens = oEvent.getParameter("tokens");
            const oMultiInput = this.getOwnerComponent().getRootControl().byId("reconciliationCountryListInput");
            const oVHD = this.getOwnerComponent().getRootControl().byId("reconciliationCountryValueHelpDialog");
            
            oMultiInput.setTokens(aTokens);
            
            if (oVHD) {
                oVHD.close();
            }
        },

        /**
         * Handler for country value help cancel in reconciliation dialog
         */
        onReconciliationCountryValueHelpCancel: function () {
            const oVHD = this.getOwnerComponent().getRootControl().byId("reconciliationCountryValueHelpDialog");
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
            const oVHD = this.getOwnerComponent().getRootControl().byId("reconciliationCompanyCodeValueHelpDialog");
            const oMultiInput = this.getOwnerComponent().getRootControl().byId("reconciliationCompanyCodeListInput");
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
            const aTokens = oEvent.getParameter("tokens");
            const oMultiInput = this.getOwnerComponent().getRootControl().byId("reconciliationCompanyCodeListInput");
            const oVHD = this.getOwnerComponent().getRootControl().byId("reconciliationCompanyCodeValueHelpDialog");
            
            oMultiInput.setTokens(aTokens);
            
            if (oVHD) {
                oVHD.close();
            }
        },

        /**
         * Handler for company code value help cancel in reconciliation dialog
         */
        onReconciliationCompanyCodeValueHelpCancel: function () {
            const oVHD = this.getOwnerComponent().getRootControl().byId("reconciliationCompanyCodeValueHelpDialog");
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



