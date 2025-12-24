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
    "sap/m/Token",
    "sap/m/VariantItem",
    "sap/m/library"
], function (Fragment, library, MessageBox, MessageToast, Filter, FilterOperator, UITableColumn, MColumn, Text, Label, ColumnListItem, Token, VariantItem, mLibrary) {
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

            const oViewModel = oView.getModel("view");
            if (!oViewModel) {
                oView.setModel(new sap.ui.model.json.JSONModel(), "view");
            }
            
            oReconciliationDialog.open();
        },


        /**
         * Handler for cancel button
         */
        onNewReconciliationCancel: function () {
            const oView = this.getView();
            const oSmartFilterBar = oView.byId("reconciliationSmartFilterBar");
            if (oSmartFilterBar) {
                oSmartFilterBar.fireClear();
            }
            oView.byId("ReconciliationDialog").close();
        },

        /**
         * Handler for search event - prevent default behavior
         */
        onReconciliationSearch: function(oEvent) {
            // Prevent the standard call
            oEvent.preventDefault();
        },

        /**
         * Handler for assigned filters changed
         */
        onReconciliationAssignedFiltersChanged: function() {
            // Can be used to react to filter changes if needed
        },

        /**
         * Handler for proceed button - validates and creates reconciliation via NewRecParameter read
         */
        onNewReconciliationProceed: async function () {
            const oView = this.getView();
            const oReconciliationDialog = oView.byId("ReconciliationDialog");
            const oSmartFilterBar = oView.byId("reconciliationSmartFilterBar");
            
            if (!oSmartFilterBar) {
                MessageToast.show("SmartFilterBar not found.");
                return;
            }

            // Validate mandatory fields
            if (!oSmartFilterBar.validateMandatoryFields()) {
                MessageToast.show(this.i18n("reconciliationPopup.PleaseFillAllMandatoryFields"));
                return;
            }

            // Get filters from SmartFilterBar
            let aFilters = oSmartFilterBar.getFilters();
            
            // Extract values from filters for validation and processing
            const mFilterValues = this._extractFilterValues(aFilters);
            
            if (!mFilterValues.companycodes || mFilterValues.companycodes.length === 0) {
                MessageToast.show(this.i18n("reconciliationPopup.CompanyCodeListMandatory"));
                return;
            }
            
            if (!mFilterValues.countries || mFilterValues.countries.length === 0) {
                MessageToast.show(this.i18n("reconciliationPopup.CountryListMandatory"));
                return;
            }
            
            if (!mFilterValues.reporting_date) {
                MessageToast.show(this.i18n("reconciliationPopup.DateRangeMandatory"));
                return;
            }

            // Get variant name from SmartVariantManagement
            const oVariantMgmt = oView.byId("reconciliationSmartVariantManagement");
            let sVariant = "";
            if (oVariantMgmt) {
                const sSelectedKey = oVariantMgmt.getSelectedKey();
                const oVariantItems = oVariantMgmt.getVariantItems();
                if (oVariantItems && sSelectedKey) {
                    const oSelectedVariant = oVariantItems.find(function(item) {
                        return item.getKey && item.getKey() === sSelectedKey;
                    });
                    if (oSelectedVariant) {
                        sVariant = oSelectedVariant.getText() || "";
                    }
                }
            }

            // Fix UTC for date filters
            this._fixUTC("reporting_date", aFilters);

            try {
                oReconciliationDialog.setBusy(true);
                
                // Read NewRecParameter for each companycode+country combination
                const aReadPromises = [];
                const aReconIds = [];
                const aCompanyCodes = mFilterValues.companycodes;
                const aCountries = mFilterValues.countries;
                const oReportingDate = mFilterValues.reporting_date;

                // Create read operations for each combination
                for (let i = 0; i < aCompanyCodes.length; i++) {
                    const sCompanyCode = aCompanyCodes[i];
                    
                    for (let j = 0; j < aCountries.length; j++) {
                        const sCountry = aCountries[j];
                        
                        // Build filters for this combination (required filters for composite key + reporting_date)
                        const aCombinationFilters = [
                            new Filter("companycode", FilterOperator.EQ, sCompanyCode),
                            new Filter("country", FilterOperator.EQ, sCountry),
                            new Filter("reporting_date", FilterOperator.EQ, oReportingDate)
                        ];
                        
                        // Add variant filter if provided (variant name from SmartVariantManagement)
                        if (sVariant) {
                            aCombinationFilters.push(new Filter("variant", FilterOperator.EQ, sVariant));
                        }

                        // Use promRead helper (from BaseController)
                        const oReadPromise = this.promRead("/NewRecParameter", {
                            filters: aCombinationFilters,
                            urlParameters: {
                                "$select": "companycode,country,reporting_date,recon_id"
                            }
                        }).then(function(oData) {
                            // Handle single result or array
                            const oResult = Array.isArray(oData.results) ? oData.results[0] : oData;
                            if (oResult && oResult.recon_id) {
                                aReconIds.push({
                                    companycode: sCompanyCode,
                                    country: sCountry,
                                    recon_id: oResult.recon_id
                                });
                            }
                            return oResult;
                        });
                        
                        aReadPromises.push(oReadPromise);
                    }
                }

                // Wait for all reads to complete
                await Promise.all(aReadPromises);
                
                oReconciliationDialog.close();
                oSmartFilterBar.fireClear();
                this._refreshView();
                MessageToast.show(this.i18n("reconciliationList.CreateReconciliationConfirmation"));
            } catch (oError) {
                this._handleReconciliationCreateError(oError);
            } finally {
                oReconciliationDialog.setBusy(false);
            }
        },

        /**
         * Fix UTC for date filters
         * @private
         */
        _fixUTC: function(sDateProperty, aFilters) {
            if (!aFilters || aFilters.length === 0 || !aFilters[0].aFilters) {
                return;
            }
            
            let oDateFilter = aFilters[0].aFilters.find(function(oFilter) {
                return oFilter.aFilters && oFilter.aFilters[0] && oFilter.aFilters[0].sPath === sDateProperty;
            });
            
            if (!oDateFilter || !oDateFilter.aFilters || !oDateFilter.aFilters[0]) {
                return;
            }
            
            const oInnerFilter = oDateFilter.aFilters[0];
            
            // Convert local date to UTC (ignoring timezone)
            if (oInnerFilter.oValue1) {
                const oDate1 = new Date(oInnerFilter.oValue1);
                oInnerFilter.oValue1 = new Date(Date.UTC(
                    oDate1.getFullYear(),
                    oDate1.getMonth(),
                    oDate1.getDate(),
                    0, 0, 0, 0
                )).toISOString();
            }
            
            if (oInnerFilter.oValue2) {
                const oDate2 = new Date(oInnerFilter.oValue2);
                oInnerFilter.oValue2 = new Date(Date.UTC(
                    oDate2.getFullYear(),
                    oDate2.getMonth(),
                    oDate2.getDate(),
                    23, 59, 59, 999
                )).toISOString();
            }
        },

        /**
         * Extract filter values from SmartFilterBar filters
         * @private
         */
        _extractFilterValues: function(aFilters) {
            const mValues = {
                companycodes: [],
                countries: [],
                reporting_date: null
            };

            if (!aFilters || aFilters.length === 0) {
                return mValues;
            }

            // SmartFilterBar filters are typically nested
            const oFilterGroup = aFilters[0];
            if (oFilterGroup && oFilterGroup.aFilters) {
                oFilterGroup.aFilters.forEach(function(oFilter) {
                    if (oFilter.aFilters) {
                        oFilter.aFilters.forEach(function(oInnerFilter) {
                            const sPath = oInnerFilter.sPath || oInnerFilter.getPath();
                            const sOperator = oInnerFilter.sOperator || oInnerFilter.getOperator();
                            
                            if (sPath === "companycode") {
                                if (sOperator === "EQ") {
                                    const sValue = oInnerFilter.oValue1 || oInnerFilter.getValue1();
                                    if (sValue && mValues.companycodes.indexOf(sValue) === -1) {
                                        mValues.companycodes.push(sValue);
                                    }
                                } else if (sOperator === "IN") {
                                    const aValues = oInnerFilter.aValues || oInnerFilter.getValues();
                                    if (aValues) {
                                        aValues.forEach(function(sValue) {
                                            if (mValues.companycodes.indexOf(sValue) === -1) {
                                                mValues.companycodes.push(sValue);
                                            }
                                        });
                                    }
                                }
                            } else if (sPath === "country") {
                                if (sOperator === "EQ") {
                                    const sValue = oInnerFilter.oValue1 || oInnerFilter.getValue1();
                                    if (sValue && mValues.countries.indexOf(sValue) === -1) {
                                        mValues.countries.push(sValue);
                                    }
                                } else if (sOperator === "IN") {
                                    const aValues = oInnerFilter.aValues || oInnerFilter.getValues();
                                    if (aValues) {
                                        aValues.forEach(function(sValue) {
                                            if (mValues.countries.indexOf(sValue) === -1) {
                                                mValues.countries.push(sValue);
                                            }
                                        });
                                    }
                                }
                            } else if (sPath === "reporting_date") {
                                // Date range filter - get the "to" date as reporting_date
                                if (sOperator === "BT") {
                                    mValues.reporting_date = oInnerFilter.oValue2 || oInnerFilter.getValue2();
                                } else if (sOperator === "EQ") {
                                    mValues.reporting_date = oInnerFilter.oValue1 || oInnerFilter.getValue1();
                                }
                            }
                        });
                    }
                });
            }

            return mValues;
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
                    const aStoredVariants = JSON.parse(sStoredVariants);
                    // Convert to VariantManagement format
                    aVariants = aStoredVariants.map(function(oVariant) {
                        return {
                            key: oVariant.key,
                            title: oVariant.title || oVariant.text,
                            author: oVariant.author || "User",
                            favorite: oVariant.favorite !== undefined ? oVariant.favorite : true,
                            sharing: oVariant.sharing || "Private",
                            data: oVariant.data
                        };
                    });
                }
                
                oViewModel.setProperty("/reconciliationList/newReconciliation/variants", aVariants);
            } catch (oError) {
                console.error("Error loading variants:", oError);
                oViewModel.setProperty("/reconciliationList/newReconciliation/variants", []);
            }
        },

        /**
         * Save reconciliation variants to localStorage
         * @private
         */
        _saveReconciliationVariants: function (aVariants) {
            const sStorageKey = "reconciliationVariants";
            
            try {
                localStorage.setItem(sStorageKey, JSON.stringify(aVariants));
            } catch (oError) {
                console.error("Error saving variants:", oError);
                MessageToast.show(this.i18n("reconciliationPopup.ErrorSavingVariant"));
            }
        },

        /**
         * Handler for variant selection (VariantManagement select event)
         */
        onReconciliationVariantSelect: function (oEvent) {
            const oParams = oEvent.getParameters();
            const sSelectedKey = oParams.key;
            
            if (!sSelectedKey) {
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
                
                // Mark as not modified after selection
                const oVariantManagement = this.getView().byId("reconciliationVariantManagement");
                if (oVariantManagement) {
                    oVariantManagement.setModified(false);
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
         * Handler for variant save (VariantManagement save event)
         */
        onReconciliationVariantSave: function (oEvent) {
            const oParams = oEvent.getParameters();
            const sVariantName = oParams.name;
            const sVariantKey = oParams.key;
            const bOverwrite = oParams.overwrite;
            const bExecute = oParams.execute;
            const bPublic = oParams.public;
            const bDef = oParams.def;
            
            if (!sVariantName) {
                return;
            }
            
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
                oEvent.preventDefault(); // Prevent saving empty variant
                return;
            }
            
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
            
            if (bOverwrite && sVariantKey) {
                // Update existing variant
                const nIndex = aVariants.findIndex(function(oVariant) {
                    return oVariant.key === sVariantKey;
                });
                if (nIndex >= 0) {
                    aVariants[nIndex].title = sVariantName;
                    aVariants[nIndex].data = oVariantData;
                    if (bDef) {
                        // Update default key in VariantManagement
                        const oVariantManagement = oView.byId("reconciliationVariantManagement");
                        if (oVariantManagement) {
                            oVariantManagement.setDefaultKey(sVariantKey);
                        }
                    }
                    MessageToast.show(this.i18n("reconciliationPopup.VariantSaved"));
                }
            } else {
                // Create new variant
                const sNewKey = "variant_" + Date.now();
                const oNewVariant = {
                    key: sNewKey,
                    title: sVariantName,
                    author: "User",
                    favorite: true,
                    data: oVariantData
                };
                
                if (bPublic) {
                    oNewVariant.sharing = "Public";
                } else {
                    oNewVariant.sharing = "Private";
                }
                
                aVariants.push(oNewVariant);
                
                // Update default key if needed
                if (bDef) {
                    const oVariantManagement = oView.byId("reconciliationVariantManagement");
                    if (oVariantManagement) {
                        oVariantManagement.setDefaultKey(sNewKey);
                    }
                }
                
                MessageToast.show(this.i18n("reconciliationPopup.VariantSaved"));
            }
            
            // Save to localStorage
            this._saveReconciliationVariants(aVariants);
            
            // Reload variants in UI
            this._loadReconciliationVariants();
            
            // Mark as not modified after save
            const oVariantManagement = oView.byId("reconciliationVariantManagement");
            if (oVariantManagement) {
                oVariantManagement.setModified(false);
            }
        },

        /**
         * Handler for variant manage (VariantManagement manage event)
         * This is called when user manages variants (delete, set default, etc.)
         */
        onReconciliationVariantManage: function (oEvent) {
            const oParams = oEvent.getParameters();
            const aDeleted = oParams.deleted || [];
            const sDef = oParams.def;
            
            // Handle deleted variants
            if (aDeleted.length > 0) {
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
                
                // Remove deleted variants
                aVariants = aVariants.filter(function(oVariant) {
                    return aDeleted.indexOf(oVariant.key) === -1;
                });
                
                // Save updated variants
                this._saveReconciliationVariants(aVariants);
                
                // Reload variants in UI
                this._loadReconciliationVariants();
            }
            
            // Handle default key change
            if (sDef !== undefined) {
                const oVariantManagement = this.getView().byId("reconciliationVariantManagement");
                if (oVariantManagement) {
                    oVariantManagement.setDefaultKey(sDef);
                }
            }
            
            // Check current variant is still valid
            this._checkCurrentVariant();
        },
        
        /**
         * Check if current selected variant still exists, if not select default
         * @private
         */
        _checkCurrentVariant: function () {
            const oView = this.getView();
            const oVariantManagement = oView.byId("reconciliationVariantManagement");
            
            if (!oVariantManagement) {
                return;
            }
            
            const sSelectedKey = oVariantManagement.getSelectedKey();
            const oItem = oVariantManagement.getItemByKey(sSelectedKey);
            
            if (!oItem) {
                const sDefaultKey = oVariantManagement.getDefaultKey();
                if (sDefaultKey) {
                    oVariantManagement.setSelectedKey(sDefaultKey);
                } else {
                    // If no default, select first available variant
                    const aItems = oVariantManagement.getItems();
                    if (aItems.length > 0) {
                        oVariantManagement.setSelectedKey(aItems[0].getKey());
                    }
                }
            }
        },

    };
});





