import { LightningElement, api, track, wire } from 'lwc';
import { closeDeleteModal, columns, confirmDelete, contentDocumentFields, initialFileCount, processFileData, sortData, toBase64 } from './fileUtils';
import { deleteRecord, getFieldValue, getRecord } from 'lightning/uiRecordApi';
import { RefreshEvent } from 'lightning/refresh';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import packageNameSpace from '@salesforce/label/c.Package_Namespace';
import { refreshApex } from '@salesforce/apex';

export default class FileManager extends LightningElement {
    @api recordId;
    @api objectApiName;
    @track objectLabel;
    @track cardTitle;
    @track recordName;
    @track sortBy;
    @track sortDirection;
    fields = ['$objectApiName.Name'];
    fileData = [];
    fileDataOriginal = [];
    filesToUpload = initialFileCount;
    uploadedFiles = initialFileCount;
    fileUrl;
    wiredFilesResult;
    fileType;
    isLoading = false;
    isDeleteModalOpen = false;
    fileToDelete = null;
    searchKey = '';
    currentFileIndex = initialFileCount;
    dataTableFiles = [];
    failedFiles = [];
    storageLimitFiles = [];
    // Track the number of processed files (both success and failure)
    processedFiles = initialFileCount;
    columns = columns;
    sortedFileData;
    namespace = packageNameSpace;
    namespaceFrameSrc;

    @wire(getObjectInfo, { objectApiName: '$objectApiName' })
    objectInfo({ data }) {
        if (data) {
            this.objectLabel = data.label;
            this.updateCardTitle();
        }
    }

    @wire(getRecord, { fields: '$fields', recordId: '$recordId' })
    wiredRecord({ data }) {
        if (data && data.fields && data.fields.Name) {
            const recordName = getFieldValue(data, `${this.objectApiName}.Name`);
            this.recordName = recordName;
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
        else if (error) { this.showToast('Error loading Files', error.body.message, 'error'); }
    }

    connectedCallback() {
        let domainUrl = '';
        if (!import.meta.env.SSR) { domainUrl = window.location.origin; }
        if(this.namespace){ this.namespaceFrameSrc = `${domainUrl}/apex/${this.namespace}__fileUploader`; }

        // This ensures the code only runs in the browser
        if (!import.meta.env.SSR) { window.addEventListener('message', this.handleMessageEvent); }
    }

    disconnectedCallback() {
        window.removeEventListener('message', this.handleMessageEvent);
    }

    renderedCallback() {
        const STYLE = document.createElement('style');
        STYLE.innerText = `.slds-form-element__label{ font-size: 13px; }`;
        this.template.querySelector('lightning-input').appendChild(STYLE);
    }

    get fileCardTitle() { return `Existing Files (${this.fileData.length})`; }

    updateCardTitle() { if (this.objectLabel && this.recordName) { this.cardTitle = `Attach Files to ${this.objectLabel} - ${this.recordName}`; } }

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

    checkUploadCompletion() { if (this.processedFiles === this.filesToUpload) { this.completeUploadProcess(); } }

    handleRefresh() { if (!import.meta.env.SSR) { this.dispatchEvent(new RefreshEvent()); } }

    completeUploadProcess() {
        this.handleFailedFiles();
        this.handleStorageLimitFiles();
        this.isLoading = false;
        this.reloadIframe();
        this.resetState();
    }

    handleFailedFiles() {
        if (this.failedFiles.length) {
            const failedFileList = this.failedFiles.join(', ');
            this.showToast('File size too large', `Failed to upload the following files: ${failedFileList}`, 'error');
        }
    }

    handleStorageLimitFiles() {
        if (this.storageLimitFiles.length) {
            const storageLimitFileList = this.storageLimitFiles.join(', ');
            this.showToast('Storage limit exceeded', `Failed to upload the following files due to storage limit: ${storageLimitFileList}`, 'error');
        }
    }

    showToast(title, message, variant) { if (!import.meta.env.SSR) { this.dispatchEvent( new ShowToastEvent({ message, title, variant })); } }

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
        if (this.searchKey) {
            this.fileData = this.fileDataOriginal.filter((file) =>
                file.name.toLowerCase().includes(this.searchKey) ||
                file.type.toLowerCase().includes(this.searchKey)
            );
        }
        else { this.fileData = this.fileDataOriginal; }
    }

    doSorting(event) {
        const { fieldName: sortByField, sortDirection: sortDirectionField } = event.detail;
        this.fileData = sortData(this.fileData, sortByField, sortDirectionField);
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
            document.addEventListener('keydown', handleEnterKey);
            fileInput.click();
            fileInput.onchange = (event) => { this.handleFileChange(event); };
            // Clean up the event listener when the component is destroyed
            this.addEventListener('destroy', () => { document.removeEventListener('keydown', handleEnterKey); });
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
                })
                .catch(() => {
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
        if (actionName === 'viewFile') {
            this.fileUrl = row.downloadUrl;
            this.fileType = row.type;
            // Get the file list and current file index
            this.dataTableFiles = this.fileData;
            this.currentFileIndex = this.dataTableFiles.findIndex(file => file.ContentVersionId === row.ContentVersionId);
            this.openPreviewModal();
        } else if (actionName === 'delete') {
            this.fileToDelete = row.id;
            this.isDeleteModalOpen = true;
        }
    }

    openPreviewModal() {
        const previewModal = this.template.querySelector('c-preview-file-modal');
        if (previewModal) { previewModal.show({ currentFileIndex: this.currentFileIndex, fileExtension: this.fileType, tableFiles: this.dataTableFiles, url: this.fileUrl }); }
    }

    handleDelete(recordId) {
        deleteRecord(recordId)
            .then(() => {
                this.fileData = this.fileData.filter(file => file.id !== recordId);
                refreshApex(this.wiredFilesResult)
                    .then(() => { this.dispatchEvent( new ShowToastEvent({ message: 'File deleted successfully', title: 'Success', variant: 'success' }));
                        this.handleRefresh();
                    })
            })
            .catch(error => { this.dispatchEvent( new ShowToastEvent({ message: error.body.message || 'An unknown error occurred', title: 'Error deleting file', variant: 'error' })); });
    }

    closeDeleteModal() {
        closeDeleteModal(this);
    }

    confirmDelete() {
        confirmDelete(this);
    }
}