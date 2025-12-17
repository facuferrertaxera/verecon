sap.ui.define([
    "sap/ui/model/type/Date",
    "sap/ui/model/type/DateTime"
], (DateType, DateTimeType) => {
    "use strict";

    return {
        /**
         * Taxera Date Type - formats date without time
         */
        TaxeraDateType: DateType.extend("tech.taxera.taxreporting.verecon.utils.types.TaxeraDateType", {
            constructor: function(oFormatOptions, oConstraints) {
                DateType.call(this, {
                    //pattern: "yyyy-MM-dd",
                    ...oFormatOptions
                }, oConstraints);
            }
        }),

        /**
         * Taxera DateTime Type - formats date with time
         */
        TaxeraDateTimeType: DateTimeType.extend("tech.taxera.taxreporting.verecon.utils.types.TaxeraDateTimeType", {
            constructor: function(oFormatOptions, oConstraints) {
                DateTimeType.call(this, {
                    //pattern: "yyyy-MM-dd HH:mm:ss",
                    ...oFormatOptions
                }, oConstraints);
            }
        })
    };
});

