import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import { LightningElement, api, wire } from 'lwc';
import { closeDeleteModal, columns, confirmDelete, contentDocumentFields, downloadFile, filterFiles, initialFileCount, processFileData, sortData, toBase64 } from 'c/utils';
import { deleteRecord, getFieldValue, getRecord } from 'lightning/uiRecordApi';
import { RefreshEvent } from 'lightning/refresh';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import { refreshApex } from '@salesforce/apex';

// eslint-disable-next-line new-cap
export default class FileManager extends NavigationMixin(LightningElement) {
    @api recordId;
    @api objectApiName;
    fields = [];
    fileData = [];
    fileDataOriginal = [];
    filesToUpload = initialFileCount;
    isModalOpen = false;
    isRecordPage = false;
    uploadedFiles = initialFileCount;
    wiredFilesResult;
    cardTitle;
    objectLabel;
    recordName;
    sortBy;
    sortDirection;
    isLoading = false;
    isDeleteModalOpen = false;
    fileToDelete = null;
    searchKey = '';
    failedFiles = [];
    storageLimitFiles = [];
    processedFiles = initialFileCount;
    columns = columns;
    sortedFileData;

    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) { if (currentPageReference.type === "standard__quickAction") { this.isModalOpen = true; } }

    @wire(getObjectInfo, { objectApiName: '$objectApiName' })
    objectInfo({ data }) {
        if (data) {            
            this.objectLabel = data.label;
            this.updateCardTitle();
        }
    }

    @wire(getRecord, { layoutTypes: ['Full'], recordId: '$recordId' })
    wiredRecord({ data }) {
        if (data && data.fields && data.fields.Name) {
            this.recordName = getFieldValue(data, `${this.objectApiName}.Name`);
            this.updateCardTitle();
        }
    }

    @wire(getRelatedListRecords, { fields: contentDocumentFields, pageSize: 1999, parentRecordId: '$recordId', relatedListId: 'ContentDocumentLinks' })
    wiredFiles(result) {
        this.searchKey = '';
        this.wiredFilesResult = result;
        const { data, error } = result;
        if (data) { 
        this.fileDataOriginal = processFileData(data.records); 
        this.fileData = [...this.fileDataOriginal]; 
        } 
        else if (error) { if (!import.meta.env.SSR){ this.dispatchEvent( new ShowToastEvent({ message: error.body.message, title: 'Error loading Files', variant: 'error' })); } }
    }

    updateCardTitle() { if (this.objectLabel && this.recordName) { this.cardTitle = `Attach Files to ${this.objectLabel} - ${this.recordName}`; } }

    handleSuccessMessage() {
        this.uploadedFiles += 1;
        this.processedFiles += 1;
        refreshApex(this.wiredFilesResult);
        this.handleRefresh();
    }

    handleErrorMessage(messageData) {
        if (messageData.message === 'File size too large') { this.failedFiles.push(messageData.filename); } 
        else if (messageData.message === 'Storage limit exceeded') { this.storageLimitFiles.push(messageData.filename); }
        this.processedFiles += 1;
    }

    // Helper method to check if processing is complete
    checkUploadCompletion() { if (this.processedFiles === this.filesToUpload) { this.completeUploadProcess(); } }

    // Main event handler method
    handleMessageEvent = (event) => {
        try {
            const messageData = JSON.parse(event.data);
            if (messageData.status === 'success') { this.handleSuccessMessage(); } 
            else if (messageData.status === 'error') { this.handleErrorMessage(messageData); }
            this.checkUploadCompletion();
        } catch (error) {
            this.failedFiles.push('Unknown Error');
            this.processedFiles += 1;
            this.checkUploadCompletion();
        }
    };

    connectedCallback() {
        if (!import.meta.env.SSR) { window.addEventListener('message', this.handleMessageEvent); }
    }

    disconnectedCallback() {
        if (typeof window !== 'undefined'){ window.removeEventListener('message', this.handleMessageEvent); }
        this[NavigationMixin.Navigate]({attributes: {actionName: 'view', recordId: this.recordId}, type: 'standard__recordPage'});
    }

    renderedCallback() {
        if (!this.template.querySelector('style[data-custom-style]')) {
            if (!import.meta.env.SSR){
                const STYLE = document.createElement('style');
                STYLE.innerText = `.slds-scrollable_y { height: auto !important; max-height: 182px !important; }
                                .slds-scrollable_x { overflow-x: hidden; }`;
                STYLE.setAttribute('data-custom-style', 'true'); 
                this.template.appendChild(STYLE);
            }
        }
    }

    //Use RefreshEvent to automatically refresh Related lists without page refresh
    handleRefresh() { if (!import.meta.env.SSR) { this.dispatchEvent(new RefreshEvent()); } }

    completeUploadProcess() {
        const MINIMUM_UPLOADED_FILES = 1;
        this.handleFailedFiles();
        this.handleStorageLimitFiles();
        this.isLoading = false;
        if(this.uploadedFiles >= MINIMUM_UPLOADED_FILES){ if (!import.meta.env.SSR){ this.dispatchEvent( new ShowToastEvent({ message: `${this.uploadedFiles} file uploaded successfully`, title: 'Success', variant: 'success' })); } }
        this.reloadIframe();
        this.resetState();
    }

    handleFailedFiles() {
        if (this.failedFiles.length) {
            const failedFileList = this.failedFiles.join(', ');
            if (!import.meta.env.SSR){ this.dispatchEvent( new ShowToastEvent({ message: `Failed to upload the following files: ${failedFileList}`, title: 'File size too large', variant: 'error' })); }
        }
    }

    handleStorageLimitFiles() {
        if (this.storageLimitFiles.length) {
            const storageLimitFileList = this.storageLimitFiles.join(', ');
            if (!import.meta.env.SSR){ this.dispatchEvent( new ShowToastEvent({ message: `Failed to upload the following files due to storage limit: ${storageLimitFileList}`, title: 'Storage limit exceeded', variant: 'error' })); }
        }
    }

    reloadIframe() {
        const iframe = this.template.querySelector('[data-id="uploadFrame"]');
        if (iframe) { iframe.src = String(iframe.src); }
    }

    resetState() {
        this.failedFiles = [];
        this.storageLimitFiles = [];
        this.uploadedFiles = 0;
        this.processedFiles = 0;
        this.filesToUpload = 0;
    }

    handleSearch(event) {
        this.searchKey = event.target.value.toLowerCase();
        this.fileData = filterFiles(this.fileDataOriginal, this.searchKey);
    }

    get fileCardTitle() { return `Existing Files (${this.fileData.length})`; }

    doSorting(event) {
        const { fieldName: sortByField, sortDirection: sortDirectionField } = event.detail;
        let sortingField = sortByField;
        if (sortByField === 'fileUrl') { sortingField = 'name'; }
        this.fileData = sortData(this.fileData, sortingField, sortDirectionField);
        this.sortBy = sortByField;
        this.sortDirection = sortDirectionField;
    }

    handleDragOver(event) {
        event.preventDefault();
        const dragText = this.template.querySelector('.drag-text'),
        dropZone = this.template.querySelector('.drop-zone');

        dropZone.classList.add('highlight');
        dragText.classList.add('text-highlight');
    }

    handleDragLeave(event) {
        event.preventDefault();
        const dragText = this.template.querySelector('.drag-text'),
        dropZone = this.template.querySelector('.drop-zone');

        dropZone.classList.remove('highlight');
        dragText.classList.remove('text-highlight');
    }

    handleFileDrop(event) {
        event.preventDefault();
        const dragText = this.template.querySelector('.drag-text'),
        dropZone = this.template.querySelector('.drop-zone'), { files } = event.dataTransfer;

        dropZone.classList.remove('highlight');
        dragText.classList.remove('text-highlight');
        this.uploadFiles(files);
    }

    handleFileSelect() {
        const fileInput = this.template.querySelector('.hidden-input');
        if (fileInput) {
            // Store event handler in a variable to remove later
            const handleEnterKey = (event) => { if (event.key === 'Enter') { fileInput.click(); }};
            // Trigger file input click on Enter key press
            if (typeof window !== 'undefined'){ document.addEventListener('keydown', handleEnterKey); }
            fileInput.click();
            fileInput.onchange = (event) => { this.handleFileChange(event); };
            // Clean up the event listener when the component is destroyed
            this.addEventListener('destroy', () => { 
                if (typeof window !== 'undefined'){ document.removeEventListener('keydown', handleEnterKey); }
            });
        }
    }

    handleFileChange(event) {
        const { files } = event.target;
        if (files.length) {
            // Convert to array if multiple files
            const filesArray = Array.from(files);
            this.uploadFiles(filesArray);
        }
    }

    uploadFiles(files) {
        const INCREMENT_BY = 1;
        this.resetState();
        this.filesToUpload = files.length;
        this.uploadedFiles = 0;
        this.isLoading = true;
        for (let file = 0; file < files.length; file += INCREMENT_BY) {            
            const fileToUpload = files[file];
            toBase64(fileToUpload)
                .then((base64Content) => {
                    const fileContent = { FirstPublishLocationId: this.recordId, PathOnClient: fileToUpload.name, Title: fileToUpload.name, VersionData: base64Content };
                    this.openVFPage(fileContent);
                }).catch(() => {
                    // Empty catch block, just handle any errors without doing anything
                });
        }
    }

    openVFPage(fileContent) {        
        const iframe = this.template.querySelector('[data-id="uploadFrame"]');
        if (iframe) { iframe.contentWindow.postMessage(JSON.stringify(fileContent), '*'); }
    }
    
    handleRowAction(event) {
        const actionName = event.detail.action.name, { row } = event.detail;
        switch (actionName) {
            case 'viewFile':
                this[NavigationMixin.Navigate]({ 
                    attributes:{ 
                        pageName:'filePreview'
                    },
                    state:{ 
                        selectedRecordId: row.id
                    },
                    type:'standard__namedPage'
                });
                break;
            case 'downloadFile':
                downloadFile(row);
                break;
            case 'delete':
                this.fileToDelete = row.id;
                this.isDeleteModalOpen = true;
                break;
            default:
                break;
        }
    }

    closeDeleteModal() { closeDeleteModal(this); }
    confirmDelete() { confirmDelete(this); }

    handleDelete(recordId) {
        deleteRecord(recordId)
            .then(() => {
                this.fileData = this.fileData.filter(file => file.id !== recordId);
                if (!import.meta.env.SSR){ this.dispatchEvent( new ShowToastEvent({ message: 'File deleted successfully', title: 'Success', variant: 'success' })); }
                this.handleRefresh();
                this[NavigationMixin.Navigate]({attributes: {actionName: 'view', recordId: this.recordId}, type: 'standard__recordPage'});
            }).catch(error => { if (!import.meta.env.SSR){ this.dispatchEvent( new ShowToastEvent({ message: error.body.message || 'An unknown error occurred', title: 'Error deleting file', variant: 'error' })); } });
    }

    closeModal() {
        this.isModalOpen = false;
        this.isRecordPage = false;
    }
}