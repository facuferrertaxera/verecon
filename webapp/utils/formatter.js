sap.ui.define([
    "sap/m/Token"
], (Token) => {
    "use strict";

    return {
        /**
         * Format reconciliation status icon based on status code
         * Used for reconciliation list items (Main view)
         * @param {string} sStatus - Status code (S, RF, P)
         * @returns {string} Icon path
         */
        formatReconciliationStatusIcon: function(sStatus) {
            if (!sStatus) {
                return "";
            }
            
            // S (Success) - Success icon (tick)
            // Using accept icon which is more reliable than sys-enter-2
            if (sStatus === "S") {
                return "sap-icon://accept";
            }
            
            // RF (Reconciliation Failed) - Error icon (cross)
            if (sStatus === "RF") {
                return "sap-icon://error";
            }

            // RF (Reconciliation Failed) - Error icon (cross)
            if (sStatus === "E") {
                return "sap-icon://error";
            }
            
            // P (Extraction in Progress) - Clock icon
            if (sStatus === "P") {
                return "sap-icon://time-entry-request";
            }
            
            // Default fallback
            return "sap-icon://in-progress-2";
        },

        /**
         * Format reconciliation status color based on status code
         * Used for reconciliation list items (Main view)
         * @param {string} sStatus - Status code (S, RF, P)
         * @returns {string} Status state (None, Success, Error, Information)
         */
        formatReconciliationStatusColor: function(sStatus) {
            if (!sStatus) {
                return "None";
            }
            
            // S (Success) - Success (green)
            if (sStatus === "S") {
                return "Success";
            }
            
            // RF (Reconciliation Failed) - Error (red)
            if (sStatus === "RF") {
                return "Error";
            }
            
            // P (Extraction in Progress) - Information (blue)
            if (sStatus === "P") {
                return "Information";
            }
            
            // Default fallback
            return "None";
        },

        /**
         * Format document status icon based on status code
         * Used for document items in reconciliation detail (ReconciliationDetail view)
         * @param {string} sStatus - Status code (S, NV, NE, E)
         * @returns {string} Icon path
         */
        formatDocumentStatusIcon: function(sStatus) {
            if (!sStatus) {
                return "";
            }
            
            // S (Reconciled) - Success icon (tick)
            // Using accept icon which is more reliable than sys-enter-2
            if (sStatus === "S") {
                return "sap-icon://accept";
            }
            
            // NV (Not in VAT Returns) - Warning icon
            if (sStatus === "NV") {
                return "sap-icon://alert";
            }
            
            // NE (Not in EC Sales List) - Warning icon
            if (sStatus === "NE") {
                return "sap-icon://alert";
            }
            
            // E (Error/Other differences) - Error icon
            if (sStatus === "E") {
                return "sap-icon://error";
            }
            
            // Default fallback
            return "sap-icon://status-in-process";
        },

        /**
         * Format document status icon with key for cell recycling fix
         * Used for document items in reconciliation detail (ReconciliationDetail view)
         * Accepts parts array [Status, DocId] to ensure unique binding per row
         * @param {Array} aParts - Array with [sStatus, sDocId]
         * @returns {string} Icon path
         */
        formatDocumentStatusIconWithKey: function(aParts) {
            const sStatus = aParts && aParts.length > 0 ? aParts[0] : null;
            // sDocId is included in parts to ensure unique binding, but not used in logic
            
            if (!sStatus) {
                return "";
            }
            
            // S (Reconciled) - Success icon (tick)
            // Using accept icon which is more reliable than sys-enter-2
            if (sStatus === "S") {
                return "sap-icon://accept";
            }
            
            // NV (Not in VAT Returns) - Warning icon
            if (sStatus === "NV") {
                return "sap-icon://alert";
            }
            
            // NE (Not in EC Sales List) - Warning icon
            if (sStatus === "NE") {
                return "sap-icon://alert";
            }
            
            // E (Error/Other differences) - Error icon
            if (sStatus === "E") {
                return "sap-icon://error";
            }
            
            // Default fallback
            return "sap-icon://status-in-process";
        },

        /**
         * Format document status color based on status code
         * Used for document items in reconciliation detail (ReconciliationDetail view)
         * @param {string} sStatus - Status code (S, NV, NE, E)
         * @returns {string} Status state (None, Success, Warning, Error)
         */
        formatDocumentStatusColor: function(sStatus) {
            if (!sStatus) {
                return "None";
            }
            
            // S (Reconciled) - Success (green)
            if (sStatus === "S") {
                return "Success";
            }
            
            // NV (Not in VAT Returns) - Warning (yellow/orange)
            if (sStatus === "NV") {
                return "Warning";
            }
            
            // NE (Not in EC Sales List) - Warning (yellow/orange)
            if (sStatus === "NE") {
                return "Warning";
            }
            
            // E (Error/Other differences) - Error (red)
            if (sStatus === "E") {
                return "Information";
            }
            
            // Default fallback
            return "None";
        },

        /**
         * Format document status icon color for Icon control
         * Used for document items in reconciliation detail (ReconciliationDetail view)
         * @param {string} sStatus - Status code (S, NV, NE, E)
         * @returns {string} Icon color (positive, critical, negative, default)
         */
        formatDocumentStatusIconColor: function(sStatus) {
            if (!sStatus) {
                return "";
            }
            
            // S (Reconciled) - Success (green)
            if (sStatus === "S") {
                return "positive";
            }
            
            // NV (Not in VAT Returns) - Warning (yellow/orange)
            if (sStatus === "NV") {
                return "critical";
            }
            
            // NE (Not in EC Sales List) - Warning (yellow/orange)
            if (sStatus === "NE") {
                return "critical";
            }
            
            // E (Error/Other differences) - Error (red)
            if (sStatus === "E") {
                return "negative";
            }
            
            // Default fallback
            return "";
        },

        /**
         * Format document status text CSS class for Text control
         * Used for document items in reconciliation detail (ReconciliationDetail view)
         * @param {string} sStatus - Status code (S, NV, NE, E)
         * @returns {string} CSS class for text color
         */
        formatDocumentStatusTextClass: function(sStatus) {
            if (!sStatus) {
                return "";
            }
            
            // S (Reconciled) - Success (green text)
            if (sStatus === "S") {
                return "sapUiTextSuccess";
            }
            
            // NV (Not in VAT Returns) - Warning (orange/yellow text)
            if (sStatus === "NV") {
                return "sapUiTextWarning";
            }
            
            // NE (Not in EC Sales List) - Warning (orange/yellow text)
            if (sStatus === "NE") {
                return "sapUiTextWarning";
            }
            
            // E (Error/Other differences) - Error (red text)
            if (sStatus === "E") {
                return "sapUiTextError";
            }
            
            // Default fallback
            return "";
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
         * Get country map from component
         * @returns {object} Country map
         */
        _getCountryMap: function() {
            if (this._oController) {
                const oComponent = this._oController.getOwnerComponent();
                if (oComponent && oComponent._mCountryMap && Object.keys(oComponent._mCountryMap).length > 0) {
                    return oComponent._mCountryMap;
                }
            }
            return {};
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
            const mCountryMap = this._getCountryMap();
            
            return aCountryCodes.map((sCode) => {
                // Get country name from map, fallback to code if not found
                const sCountryName = (mCountryMap && mCountryMap[sCode]) ? mCountryMap[sCode] : sCode;
                // Format as "CountryName (CODE)"
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
        },

        /**
         * Format difference amount state for ObjectNumber
         * @param {number} fAmount - Difference amount
         * @returns {string} State (None, Success, Warning, Error)
         */
        formatDiffAmountState: function(fAmount) {
            if (fAmount === null || fAmount === undefined) {
                return "None";
            }
            
            // If difference is zero, show as success (no difference)
            if (fAmount === 0) {
                return "Success";
            }
            
            // If there's a difference, show as error (mismatch)
            return "Error";
        },

        /**
         * Format number with scale (K, M, etc.) without currency
         * @param {number} fValue - Numeric value
         * @returns {string} Formatted value with scale
         */
        formatNumberWithScale: function(fValue) {
            if (fValue === null || fValue === undefined || isNaN(fValue)) {
                return "0";
            }
            
            const fAbsValue = Math.abs(fValue);
            
            // Billions
            if (fAbsValue >= 1000000000) {
                const fFormatted = (fValue / 1000000000).toFixed(1);
                return (parseFloat(fFormatted) % 1 === 0 ? parseInt(fFormatted) : fFormatted) + "B";
            }
            // Millions
            else if (fAbsValue >= 1000000) {
                const fFormatted = (fValue / 1000000).toFixed(1);
                return (parseFloat(fFormatted) % 1 === 0 ? parseInt(fFormatted) : fFormatted) + "M";
            }
            // Thousands
            else if (fAbsValue >= 1000) {
                const fFormatted = (fValue / 1000).toFixed(1);
                return (parseFloat(fFormatted) % 1 === 0 ? parseInt(fFormatted) : fFormatted) + "K";
            }
            // Less than 1000
            else {
                return fValue.toString();
            }
        },

        /**
         * Format currency value with EUR
         * @param {number} fValue - Currency value
         * @returns {string} Formatted currency string
         */
        formatCurrency: function(fValue) {
            if (fValue === null || fValue === undefined || isNaN(fValue)) {
                return "EUR 0.00";
            }
            
            // Format with 2 decimal places
            const fFormatted = Math.abs(fValue).toFixed(2);
            const sSign = fValue < 0 ? "-" : "";
            return "EUR " + sSign + fFormatted;
        },

        /**
         * Format document count with "docs" suffix
         * @param {number} iCount - Document count
         * @returns {string} Formatted string like "100 docs"
         */
        formatDocCount: function(iCount) {
            const iDocCount = iCount || 0;
            return iDocCount + " docs";
        },

        /**
         * Format group subtotals for display in group header
         * @param {object} mGroupTotals - Map of all group totals
         * @param {string} sGroupKey - Group key (CompanyCode|Box)
         * @returns {string} Formatted subtotal text
         */
        formatGroupSubtotal: function(mGroupTotals, sGroupKey) {
            if (!mGroupTotals || !sGroupKey) {
                return "";
            }
            
            const oGroupTotal = mGroupTotals[sGroupKey];
            if (!oGroupTotal) {
                return "";
            }
            
            const sCurrency = oGroupTotal.Currencycode || "";
            const aParts = [];
            
            // Add key subtotals
            if (oGroupTotal.DiffGrossAmount) {
                const fDiffGross = Math.abs(parseFloat(oGroupTotal.DiffGrossAmount || 0));
                if (fDiffGross > 0) {
                    aParts.push(`Diff: ${fDiffGross.toFixed(2)} ${sCurrency}`);
                }
            }
            
            return aParts.length > 0 ? aParts.join(", ") : "";
        },

        /**
         * Format group subtotal count
         * @param {object} mGroupTotals - Map of all group totals
         * @param {string} sGroupKey - Group key
         * @returns {string} Formatted count
         */
        formatGroupSubtotalCount: function(mGroupTotals, sGroupKey) {
            // This can be used to show count of items in group if needed
            return "";
        },

        /**
         * Format group subtotal summary text
         * @param {object} mGroupTotals - Map of all group totals
         * @param {string} sGroupKey - Group key (CompanyCode|Box)
         * @returns {string} Formatted summary text
         */
        formatGroupSubtotalSummary: function(mGroupTotals, sGroupKey) {
            if (!mGroupTotals || !sGroupKey) {
                return "Subtotals";
            }
            
            const oGroupTotal = mGroupTotals[sGroupKey];
            if (!oGroupTotal) {
                return "Subtotals";
            }
            
            return "Subtotals";
        },

        /**
         * Format group subtotal currency value for display in group header cells
         * @param {object} mGroupTotals - Map of all group totals
         * @param {string} sGroupKey - Group key (CompanyCode|Box)
         * @param {string} sFieldName - Field name (e.g., "VatrBaseAmount")
         * @param {string} sCurrencyField - Currency field name (usually "Currencycode")
         * @returns {string} Formatted currency value
         */
        formatGroupSubtotalCurrency: function(mGroupTotals, sGroupKey, sFieldName, sCurrencyField) {
            if (!mGroupTotals || !sGroupKey || !sFieldName) {
                return "";
            }
            
            const oGroupTotal = mGroupTotals[sGroupKey];
            if (!oGroupTotal || !oGroupTotal[sFieldName]) {
                return "";
            }
            
            const fValue = parseFloat(oGroupTotal[sFieldName] || 0);
            if (isNaN(fValue) || fValue === 0) {
                return "";
            }
            
            // Round to 2 decimal places
            const fRounded = Math.round(fValue * 100) / 100;
            const sCurrency = oGroupTotal[sCurrencyField] || "";
            
            // Format as currency with currency code
            return fRounded.toFixed(2) + " " + sCurrency;
        }
    };
});

