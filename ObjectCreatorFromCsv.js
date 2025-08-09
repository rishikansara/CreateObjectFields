import { LightningElement, track } from 'lwc';
// Import NavigationMixin for redirection
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createObjectFromCsv from '@salesforce/apex/ObjectCreatorController.createObjectFromCsv';

// Wrap the class with NavigationMixin
export default class ObjectCreatorFromCsv extends NavigationMixin(LightningElement) {
    @track fileContents;
    @track isLoading = false;
    @track fileName; // Property to hold the file name

    get isProcessDisabled() {
        return !this.fileContents;
    }

    // Store the file name and contents when a file is selected
    handleFileChange(event) {
        const file = event.target.files[0];
        if (file) {
            this.fileName = file.name;
            const reader = new FileReader();
            reader.onload = () => {
                this.fileContents = reader.result;
            };
            reader.readAsText(file);
        } else {
            // Clear the file name and contents if the user cancels
            this.fileName = null;
            this.fileContents = null;
        }
    }

    async handleProcess() {
        if (!this.fileContents) {
            this.showToast('Error', 'Please upload a file first.', 'error');
            return;
        }

        this.isLoading = true;

        try {
            const jsonMetadata = this.parseCsvToJson(this.fileContents);
            
            // Call Apex to enqueue the job
            await createObjectFromCsv({ jsonMetadata });
            
            // Show a success message before redirecting
            this.showToast('Success', 'The object creation job has been started.', 'success');

            // Redirect to the standard Apex Jobs page
            this[NavigationMixin.Navigate]({
                type: 'standard__webPage',
                attributes: {
                    url: '/lightning/setup/AsyncApexJobs/home'
                }
            });

        } catch (error) {
            this.showToast('Error', error.body ? error.body.message : error.message, 'error');
            this.isLoading = false; // Stop the spinner on error
        }
    }

    // This function is updated to handle the 'NameField' row type
    parseCsvToJson(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].trim().split(',');

        const objectWrapper = { fields: [] };
        let nameFieldWrapper = null;

        // Start from the first data row (index 1)
        lines.slice(1).forEach(line => {
            const data = line.trim().split(',');
            const rowType = data[headers.indexOf('Type')];

            if (rowType === 'Object') {
                objectWrapper.objectLabel = data[headers.indexOf('Label')];
                objectWrapper.objectPluralLabel = data[headers.indexOf('PluralLabel')];
            } else if (rowType === 'NameField') {
                nameFieldWrapper = {
                    fieldLabel: data[headers.indexOf('Label')],
                    dataType: data[headers.indexOf('DataType')],
                    displayFormat: data[headers.indexOf('DisplayFormat')]
                };
            } else if (rowType === 'Field') {
                const fieldWrapper = {
                    fieldLabel: data[headers.indexOf('Label')],
                    dataType: data[headers.indexOf('DataType')]
                };
                objectWrapper.fields.push(fieldWrapper);
            }
        });

        // Add the parsed Name Field to the main wrapper
        objectWrapper.nameField = nameFieldWrapper;

        return JSON.stringify(objectWrapper);
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
