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
            
            // Load variants from localStorage
            this._loadReconciliationVariants();
            
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
        },

        /**
         * Load reconciliation variants from localStorage
         * @private
         */
        _loadReconciliationVariants: function () {
            const sStorageKey = "reconciliationVariants";
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            
            try {
                const sStoredVariants = localStorage.getItem(sStorageKey);
                let aVariants = [];
                
                if (sStoredVariants) {
                    aVariants = JSON.parse(sStoredVariants);
                }
                
                // Add empty option
                aVariants.unshift({
                    key: "",
                    text: this.i18n("reconciliationPopup.NoVariant")
                });
                
                oViewModel.setProperty("/reconciliationList/newReconciliation/variants", aVariants);
            } catch (oError) {
                console.error("Error loading variants:", oError);
                oViewModel.setProperty("/reconciliationList/newReconciliation/variants", [{
                    key: "",
                    text: this.i18n("reconciliationPopup.NoVariant")
                }]);
            }
        },

        /**
         * Save reconciliation variants to localStorage
         * @private
         */
        _saveReconciliationVariants: function (aVariants) {
            const sStorageKey = "reconciliationVariants";
            
            try {
                // Filter out the empty option before saving
                const aVariantsToSave = aVariants.filter(function(oVariant) {
                    return oVariant.key !== "";
                });
                localStorage.setItem(sStorageKey, JSON.stringify(aVariantsToSave));
            } catch (oError) {
                console.error("Error saving variants:", oError);
                MessageToast.show(this.i18n("reconciliationPopup.ErrorSavingVariant"));
            }
        },

        /**
         * Handler for variant selection change
         */
        onReconciliationVariantChange: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) {
                return;
            }
            
            const sSelectedKey = oSelectedItem.getKey();
            
            if (!sSelectedKey) {
                // Empty variant selected - clear form
                return;
            }
            
            const sStorageKey = "reconciliationVariants";
            
            try {
                const sStoredVariants = localStorage.getItem(sStorageKey);
                if (!sStoredVariants) {
                    return;
                }
                
                const aVariants = JSON.parse(sStoredVariants);
                const oSelectedVariant = aVariants.find(function(oVariant) {
                    return oVariant.key === sSelectedKey;
                });
                
                if (oSelectedVariant && oSelectedVariant.data) {
                    this._applyReconciliationVariant(oSelectedVariant.data);
                }
            } catch (oError) {
                console.error("Error loading variant:", oError);
                MessageToast.show(this.i18n("reconciliationPopup.ErrorLoadingVariant"));
            }
        },

        /**
         * Apply variant data to form fields
         * @private
         */
        _applyReconciliationVariant: function (oVariantData) {
            const oView = this.getView();
            const oReconciliationDialog = oView.byId("ReconciliationDialog");
            const oContext = oReconciliationDialog.getBindingContext();
            const sPath = oContext.getPath();
            const oModel = oReconciliationDialog.getModel();
            
            // Apply date range
            if (oVariantData.FromDate && oVariantData.ToDate) {
                oModel.setProperty(sPath + "/FromDate", oVariantData.FromDate);
                oModel.setProperty(sPath + "/ToDate", oVariantData.ToDate);
            }
            
            // Apply country tokens
            if (oVariantData.CountryList && Array.isArray(oVariantData.CountryList)) {
                const aCountryTokens = oVariantData.CountryList.map(function(oCountry) {
                    return new Token({
                        key: oCountry.key,
                        text: oCountry.text
                    });
                });
                oView.byId("reconciliationCountryListInput").setTokens(aCountryTokens);
            }
            
            // Apply company code tokens
            if (oVariantData.CompanyCodeList && Array.isArray(oVariantData.CompanyCodeList)) {
                const aCompanyCodeTokens = oVariantData.CompanyCodeList.map(function(oCompanyCode) {
                    return new Token({
                        key: oCompanyCode.key,
                        text: oCompanyCode.text
                    });
                });
                oView.byId("reconciliationCompanyCodeListInput").setTokens(aCompanyCodeTokens);
            }
        },

        /**
         * Handler for save variant button
         */
        onSaveReconciliationVariant: function () {
            const oView = this.getView();
            const oReconciliationDialog = oView.byId("ReconciliationDialog");
            const oContext = oReconciliationDialog.getBindingContext();
            const oReconciliation = oContext.getObject();
            
            // Get current form values
            const oCountryInput = oView.byId("reconciliationCountryListInput");
            const oCompanyCodeInput = oView.byId("reconciliationCompanyCodeListInput");
            const aCountryTokens = oCountryInput.getTokens();
            const aCompanyCodeTokens = oCompanyCodeInput.getTokens();
            
            // Check if form has values
            if (aCountryTokens.length === 0 && aCompanyCodeTokens.length === 0 && !oReconciliation.FromDate && !oReconciliation.ToDate) {
                MessageToast.show(this.i18n("reconciliationPopup.NoDataToSave"));
                return;
            }
            
            // Prompt for variant name
            MessageBox.prompt(this.i18n("reconciliationPopup.EnterVariantName"), {
                title: this.i18n("reconciliationPopup.SaveVariant"),
                defaultValue: "",
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (sAction, sVariantName) {
                    if (sAction === MessageBox.Action.OK && sVariantName) {
                        this._saveReconciliationVariant(sVariantName.trim());
                    }
                }.bind(this)
            });
        },

        /**
         * Save current form state as a variant
         * @private
         */
        _saveReconciliationVariant: function (sVariantName) {
            const oView = this.getView();
            const oReconciliationDialog = oView.byId("ReconciliationDialog");
            const oContext = oReconciliationDialog.getBindingContext();
            const oReconciliation = oContext.getObject();
            
            // Get current form values
            const oCountryInput = oView.byId("reconciliationCountryListInput");
            const oCompanyCodeInput = oView.byId("reconciliationCompanyCodeListInput");
            const aCountryTokens = oCountryInput.getTokens();
            const aCompanyCodeTokens = oCompanyCodeInput.getTokens();
            
            // Build variant data
            const oVariantData = {
                FromDate: oReconciliation.FromDate,
                ToDate: oReconciliation.ToDate,
                CountryList: aCountryTokens.map(function(oToken) {
                    return {
                        key: oToken.getKey(),
                        text: oToken.getText()
                    };
                }),
                CompanyCodeList: aCompanyCodeTokens.map(function(oToken) {
                    return {
                        key: oToken.getKey(),
                        text: oToken.getText()
                    };
                })
            };
            
            // Generate unique key
            const sVariantKey = "variant_" + Date.now();
            
            // Get existing variants
            const sStorageKey = "reconciliationVariants";
            let aVariants = [];
            
            try {
                const sStoredVariants = localStorage.getItem(sStorageKey);
                if (sStoredVariants) {
                    aVariants = JSON.parse(sStoredVariants);
                }
            } catch (oError) {
                console.error("Error loading variants:", oError);
            }
            
            // Check if variant name already exists
            const bVariantExists = aVariants.some(function(oVariant) {
                return oVariant.text === sVariantName;
            });
            
            if (bVariantExists) {
                MessageBox.warning(this.i18n("reconciliationPopup.VariantNameExists"));
                return;
            }
            
            // Add new variant
            aVariants.push({
                key: sVariantKey,
                text: sVariantName,
                data: oVariantData
            });
            
            // Save to localStorage
            this._saveReconciliationVariants(aVariants);
            
            // Reload variants in UI
            this._loadReconciliationVariants();
            
            // Select the newly saved variant
            const oVariantSelect = oView.byId("reconciliationVariantSelect");
            oVariantSelect.setSelectedKey(sVariantKey);
            
            MessageToast.show(this.i18n("reconciliationPopup.VariantSaved"));
        },

        /**
         * Handler for manage variants button
         */
        onManageReconciliationVariants: function () {
            const oView = this.getView();
            const oManageDialog = oView.byId("reconciliationManageVariantsDialog");
            const oViewModel = oView.getModel("view");
            
            // Load variants excluding the empty option for the manage dialog
            const sStorageKey = "reconciliationVariants";
            try {
                const sStoredVariants = localStorage.getItem(sStorageKey);
                let aVariants = [];
                
                if (sStoredVariants) {
                    aVariants = JSON.parse(sStoredVariants);
                }
                
                oViewModel.setProperty("/reconciliationList/newReconciliation/manageVariants", aVariants);
            } catch (oError) {
                console.error("Error loading variants:", oError);
                oViewModel.setProperty("/reconciliationList/newReconciliation/manageVariants", []);
            }
            
            if (oManageDialog) {
                oManageDialog.open();
            }
        },

        /**
         * Handler for selecting variant from manage dialog
         */
        onSelectReconciliationVariantFromManage: function (oEvent) {
            const oItem = oEvent.getSource();
            const sVariantKey = oItem.getBindingContext("view").getProperty("key");
            
            if (sVariantKey) {
                const oVariantSelect = this.getView().byId("reconciliationVariantSelect");
                oVariantSelect.setSelectedKey(sVariantKey);
                
                // Trigger variant change manually
                const oSelectedItem = oVariantSelect.getSelectedItem();
                if (oSelectedItem) {
                    const sStorageKey = "reconciliationVariants";
                    try {
                        const sStoredVariants = localStorage.getItem(sStorageKey);
                        if (sStoredVariants) {
                            const aVariants = JSON.parse(sStoredVariants);
                            const oSelectedVariant = aVariants.find(function(oVariant) {
                                return oVariant.key === sVariantKey;
                            });
                            
                            if (oSelectedVariant && oSelectedVariant.data) {
                                this._applyReconciliationVariant(oSelectedVariant.data);
                            }
                        }
                    } catch (oError) {
                        console.error("Error loading variant:", oError);
                        MessageToast.show(this.i18n("reconciliationPopup.ErrorLoadingVariant"));
                    }
                }
            }
            
            this.getView().byId("reconciliationManageVariantsDialog").close();
        },

        /**
         * Handler for deleting variant
         */
        onDeleteReconciliationVariant: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oBindingContext = oItem.getBindingContext("view");
            const sVariantKey = oBindingContext.getProperty("key");
            
            if (!sVariantKey) {
                return;
            }
            
            MessageBox.confirm(this.i18n("reconciliationPopup.ConfirmDeleteVariant"), {
                title: this.i18n("reconciliationPopup.DeleteVariant"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._deleteReconciliationVariant(sVariantKey);
                    }
                }.bind(this)
            });
        },

        /**
         * Delete a variant
         * @private
         */
        _deleteReconciliationVariant: function (sVariantKey) {
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            const sStorageKey = "reconciliationVariants";
            
            try {
                const sStoredVariants = localStorage.getItem(sStorageKey);
                if (!sStoredVariants) {
                    return;
                }
                
                let aVariants = JSON.parse(sStoredVariants);
                aVariants = aVariants.filter(function(oVariant) {
                    return oVariant.key !== sVariantKey;
                });
                
                this._saveReconciliationVariants(aVariants);
                this._loadReconciliationVariants();
                
                // Update manage dialog list if it's open
                oViewModel.setProperty("/reconciliationList/newReconciliation/manageVariants", aVariants);
                
                // Clear selection if deleted variant was selected
                const oVariantSelect = oView.byId("reconciliationVariantSelect");
                if (oVariantSelect.getSelectedKey() === sVariantKey) {
                    oVariantSelect.setSelectedKey("");
                }
                
                MessageToast.show(this.i18n("reconciliationPopup.VariantDeleted"));
            } catch (oError) {
                console.error("Error deleting variant:", oError);
                MessageToast.show(this.i18n("reconciliationPopup.ErrorDeletingVariant"));
            }
        },

        /**
         * Handler for closing manage variants dialog
         */
        onCloseManageVariantsDialog: function () {
            this.getView().byId("reconciliationManageVariantsDialog").close();
        }
    };
});





