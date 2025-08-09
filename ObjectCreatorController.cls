/**
 * @description Receives data from the LWC and calls a future method to run the metadata creation.
 */
public without sharing class ObjectCreatorController {

    // This is the method your LWC will call.
    @AuraEnabled
    public static void createObjectFromCsv(String jsonMetadata) {
        // Deserialize the JSON from the LWC to get the parameters
        MetadataWrapper wrapper = (MetadataWrapper) JSON.deserialize(jsonMetadata, MetadataWrapper.class);

        String objectLabel = wrapper.objectLabel;
        String pluralLabel = wrapper.objectPluralLabel;
        String description = 'Created via LWC CSV Uploader.';
        
        // Pass the entire wrapper object as a JSON string to the future method
        String wrapperJson = JSON.serialize(wrapper);

        // Call the asynchronous method to do the work
        createMetadataAsync(objectLabel, pluralLabel, description, wrapperJson);
    }

    /**
     * @description This @future method runs in the background and calls your MetadataUtil class.
     */
    @future(callout=true)
    public static void createMetadataAsync(String objectLabel, String pluralLabel, String description, String wrapperJson) {
        
        MetadataWrapper wrapper = (MetadataWrapper) JSON.deserialize(wrapperJson, MetadataWrapper.class);
        List<FieldWrapper> fields = wrapper.fields;
        String objectApiName = objectLabel.replace(' ', '_') + '__c';

        try {
            // 1. Check the Name Field type and call the correct creation method
            if (wrapper.nameField != null && wrapper.nameField.dataType == 'AutoNumber') {
                // Call the method for creating an object with an Auto-Number Name field
                MetadataUtil.createObjectWithAN(objectLabel, pluralLabel, description, wrapper.nameField.displayFormat);
            } else {
                // Call the standard method for creating an object with a Text Name field
                MetadataUtil.createObject(objectLabel, pluralLabel, description);
            }

            // 2. Loop and create each subsequent field
            List<String> fieldApiNamesForPerms = new List<String>();
            for (FieldWrapper fw : fields) {
                String fieldApiName = fw.fieldLabel.replace(' ', '_') + '__c';
                fieldApiNamesForPerms.add(fieldApiName);

                if (fw.dataType == 'Text') {
                    MetadataUtil.createFields(objectApiName, fw.fieldLabel, false, false, false, false);
                } else if (fw.dataType == 'Number') {
                    MetadataUtil.createNumberField(objectApiName, fw.fieldLabel, false, false, false);
                }
                // Add more conditions here for other field types in your MetadataUtil class
            }

            // 3. Assign Field Level Security to the System Admin profile
            if (!fieldApiNamesForPerms.isEmpty()) {
                MetadataUtil.updateFieldLevelSecurityToProfile(fieldApiNamesForPerms, objectApiName, 'Admin');
            }

        } catch (Exception e) {
            System.debug('Error during metadata creation: ' + e.getMessage());
        }
    }

    // Helper classes to parse the JSON from the LWC
    public class MetadataWrapper {
        public String objectLabel;
        public String objectPluralLabel;
        public NameFieldWrapper nameField; // To hold Name Field details
        public List<FieldWrapper> fields;
    }

    public class NameFieldWrapper {
        public String fieldLabel;
        public String dataType;
        public String displayFormat;
    }

    public class FieldWrapper {
        public String fieldLabel;
        public String dataType;
    }
}
