sap.ui.define([
    "sap/m/Token"
], (Token) => {
    "use strict";

    return {
        /**
         * Format status icon based on status code
         * @param {string} sStatus - Status code
         * @returns {string} Icon path
         */
        formatStatusIcon: function(sStatus) {
            if (!sStatus) {
                return "";
            }
            const mStatusIcons = {
                "C": "sap-icon://status-in-process",  // Created/In Process
                "P": "sap-icon://pending",            // Pending
                "RP": "sap-icon://complete",          // Ready/Processed
                "SS": "sap-icon://accept",            // Success
                "E": "sap-icon://error",              // Error
                "W": "sap-icon://warning"            // Warning
            };
            return mStatusIcons[sStatus] || "";
        },

        /**
         * Format status color based on status code
         * @param {string} sStatus - Status code
         * @returns {string} Status state (None, Success, Warning, Error)
         */
        formatStatusColor: function(sStatus) {
            if (!sStatus) {
                return "None";
            }
            const mStatusColors = {
                "C": "Warning",      // Created/In Process
                "P": "Warning",      // Pending
                "RP": "Success",     // Ready/Processed
                "SS": "Success",     // Success
                "E": "Error",        // Error
                "W": "Warning"       // Warning
            };
            return mStatusColors[sStatus] || "None";
        },

        /**
         * Store controller reference for formatters
         */
        _oController: null,

        /**
         * Set controller reference
         */
        setController: function(oController) {
            this._oController = oController;
        },

        /**
         * Format country list to tokens array
         * @param {string} sCountryList - Comma-separated country codes
         * @returns {Array} Array of Token objects
         */
        formatCountryListToTokens: function(sCountryList) {
            if (!sCountryList) {
                return [];
            }
            
            const aCountryCodes = sCountryList.split(",").map(s => s.trim()).filter(s => s);
            const mCountryMap = this._oController && this._oController._mCountryMap ? this._oController._mCountryMap : {};
            
            return aCountryCodes.map((sCode) => {
                const sCountryName = mCountryMap[sCode] || sCode;
                return new Token({
                    key: sCode,
                    text: sCountryName + " (" + sCode + ")"
                });
            });
        },

        /**
         * Format company code list to tokens array
         * @param {string} sCompanyCodeList - Comma-separated company codes
         * @returns {Array} Array of Token objects
         */
        formatCompanyCodeListToTokens: function(sCompanyCodeList) {
            if (!sCompanyCodeList) {
                return [];
            }
            
            const aCompanyCodes = sCompanyCodeList.split(",").map(s => s.trim()).filter(s => s);
            
            return aCompanyCodes.map((sCode) => {
                return new Token({
                    key: sCode,
                    text: sCode
                });
            });
        }
    };
});

