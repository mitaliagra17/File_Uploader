import { LightningElement, api, wire } from 'lwc';
import { closeDeleteModal, columns, confirmDelete, contentDocumentFields, downloadFile, filterFiles, processFileData, sortData } from 'c/utils';
import { NavigationMixin } from 'lightning/navigation';
import { RefreshEvent } from 'lightning/refresh';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { deleteRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';

// eslint-disable-next-line new-cap
export default class DisplayUploadedFiles extends NavigationMixin(LightningElement) {
    @api recordId;
    fileData = [];
    fileDataOriginal = [];
    searchKey = '';
    wiredFilesResult;
    columns = columns;
    isDeleteModalOpen = false;
    fileToDelete = null;

    @wire(getRelatedListRecords, { fields: contentDocumentFields, pageSize: 1999, parentRecordId: '$recordId', relatedListId: 'ContentDocumentLinks' })
    wiredFiles(result) {
        this.searchKey = '';
        this.wiredFilesResult = result;
        const { data, error } = result;

        if (data) { 
        this.fileDataOriginal = processFileData(data.records); 
        this.fileData = [...this.fileDataOriginal]; 
        } 
        else if (error) { 
            if (!import.meta.env.SSR){
                this.dispatchEvent( new ShowToastEvent({ message: error.body.message || 'An unknown error occurred', title: 'Error loading files', variant: 'error' }));
            }
        }
    }

    get fileCardTitle() { return `Existing Files (${this.fileData.length})`; }

    handleRefresh() { 
        if (!import.meta.env.SSR) { 
            this.dispatchEvent(new RefreshEvent()); 
        } 
    }

    handleSearch(event) {
        this.searchKey = event.target.value.toLowerCase();
        this.fileData = filterFiles(this.fileDataOriginal, this.searchKey);
    }

    doSorting(event) {
        const { fieldName: sortByField, sortDirection: sortDirectionField } = event.detail;
        let sortingField = sortByField;
        if (sortByField === 'fileUrl') {
            sortingField = 'name';
        }
        this.fileData = sortData(this.fileData, sortingField, sortDirectionField);
        this.sortBy = sortByField;
        this.sortDirection = sortDirectionField;
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name, { row } = event.detail;
        switch (actionName) {
            case 'viewFile':
                this[NavigationMixin.Navigate]({
                    attributes: {
                        pageName: 'filePreview'
                    },
                    state: {
                        selectedRecordId: row.id
                    },
                    type: 'standard__namedPage'
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

    handleDelete(recordId) {
        deleteRecord(recordId)
            .then(() => {
                this.fileData = this.fileData.filter(file => file.id !== recordId);
                if (!import.meta.env.SSR){
                    this.dispatchEvent( new ShowToastEvent({ message: 'File deleted successfully', title: 'Success', variant: 'success' }));
                }
                this.handleRefresh();
            })
            .catch(error => { if (!import.meta.env.SSR) {
                this.dispatchEvent( new ShowToastEvent({ message: error.body.message || 'An unknown error occurred', title: 'Error deleting file', variant: 'error' })); 
            }});
        }

    confirmDelete() {
        confirmDelete(this);
    }

    closeDeleteModal() {
        closeDeleteModal(this);
    }
}