/*global history */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/routing/HashChanger",
    "sap/ui/Device"
], function (Controller, History, MessageToast, MessageBox, HashChanger, Device) {
    "use strict";

    return Controller.extend("tech.taxera.taxreporting.verecon.controller.BaseController", {

        onNavTo: function (oEvent, sRoute) {
            // Initialize the controller
            this.getRouter().navTo(sRoute);
        },

        /**
		 * Wrapper function to navigate to the due route without checking for pending changes
		 * @public
		 * @param {string} aRouteName of the route
		 * @param {object} oParameters of the route
		 */
        navToDirect: function (aRouteName, oParameters, bReplace) {
            this.getOwnerComponent().getRouter().navTo(aRouteName, oParameters, {}, bReplace);
        },
        /**
         * Convenience method for accessing the router in every controller of the application.
         * @public
         * @returns {sap.ui.core.routing.Router} the router for this component
         */
        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        },

		/**
		 * Convenience method for getting the view model by name in every controller of the application.
		 * @public
		 * @param {string} sName the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
        getModel: function (sName) {
            return this.getView().getModel(sName);
        },

		/**
		 * Convenience method for setting the view model in every controller of the application.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

		/**
		 * Get translation value by key sKey and params aParams
		 */
        i18n: function (sKey, aParams) {
            return this.getModel("i18n").getResourceBundle().getText(sKey, aParams);
        },

		/**
		 * Convenience function to get sap.ui.Core Message Manager
		 * @returns {object} sap.ui.core.message.MessageManager
		 * @public
		 */
        getMessageManager: function () {
            return sap.ui.getCore().getMessageManager();
        },

		/**
		 * Helper private method to confirm deletion of an item and fire the deletion.
		 * @param {object} oRecord - Element to be deleted
		 * @param {string} sMessage - Message to show for confirmation
		 * @returns {object} Promise
		 */
        _confirmDeleteItem: function (oRecord, sMessage) {
            return new Promise(function (resolve) {
                MessageBox.confirm(sMessage, {
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            resolve(oRecord);
                        } else {
                            resolve();
                        }
                    }
                });
            });
        },

		/**
		 * Internal method to rematch the current route: It will trigger all the current route matched events
		 */
        _rematchRoute: function () {
            var oHashChanger = HashChanger.getInstance();
            this.getRouter().parse(oHashChanger.getHash());
        },

        getContentDensityClass: function () {
            if (!this._sContentDensityClass) {
                if (!Device.support.touch) {
                    this._sContentDensityClass = "sapUiSizeCompact";
                } else {
                    this._sContentDensityClass = "sapUiSizeCozy";
                }
            }
            return this._sContentDensityClass;
        },

        _changeRoute: function (sNewRoute) {
            var oHashChanger = HashChanger.getInstance();
            oHashChanger.setHash(sNewRoute);
        },

        checkIfEmpty: function (object) {
            if (Object.entries(object).length === 0) {
                return true;
            }
            return false;
        },

        checkIfObject: function (suspectedObject) {
            return typeof suspectedObject === 'object' &&
                !Array.isArray(suspectedObject) &&
                suspectedObject !== null;
        },

        delay: function (time) {
            return new Promise(resolve => setTimeout(resolve, time));
        },

        showErrorMessage: function(oError){
            var sMessage = "";
            if(oError.hasOwnProperty("responseText")){
                sMessage = JSON.parse(oError.responseText).error.message.value;
            } 
            if(oError.hasOwnProperty("response") && oError.response.hasOwnProperty("body")){
                sMessage = JSON.parse(oError.response.body).error.message.value;
            }
            MessageBox.error(sMessage);
        },

        /**
         * Promise-based read helper for OData model
         * @param {string} sPath - Entity path
         * @param {object} mParameters - Read parameters (filters, urlParameters, etc.)
         * @returns {Promise} Promise that resolves with response or rejects with error
         */
        promRead: function(sPath, mParameters) {
            const oModel = this.getModel();
            return new Promise((resolve, reject) => {
                const mReadParams = {
                    success: function(oData) {
                        resolve(oData);
                    },
                    error: function(oError) {
                        reject(oError);
                    }
                };
                
                // Copy parameters (filters, urlParameters, etc.) to read params
                if (mParameters) {
                    Object.keys(mParameters).forEach((sKey) => {
                        if (sKey !== "success" && sKey !== "error") {
                            mReadParams[sKey] = mParameters[sKey];
                        }
                    });
                }
                
                oModel.read(sPath, mReadParams);
            });
        }
    });

});






