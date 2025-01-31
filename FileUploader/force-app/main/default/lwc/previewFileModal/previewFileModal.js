import { LightningElement, api, track } from 'lwc';

const LAST_INDEX_OFFSET = 1;

export default class PreviewFileModal extends LightningElement {
    @api url;
    @api fileExtension;
    @api currentFileIndex;
    @api tableFiles = [];
    isPreviousDisabled = true;
    isNextDisabled = false;
    showFrame = false;
    showModal = false;
    isLoading = false;
    isPreviewAvailable = false;
    downloadUrl;
    modalStyle;
    @track privateUrl;
    @track privateFileExtension;
    @track privateCurrentFileIndex;
    @track privateTableFiles = [];

    hasRendered = false;

    renderedCallback() {
        this.setModalWidth();
        if (this.hasRendered) {
            return;
        }
        const arrowButtons = this.template.querySelectorAll('.arrow-button');

        if (arrowButtons.length) {
            const STYLE = document.createElement('style');
            STYLE.innerText = `.slds-button_icon-border {
            border: 0px;
        }`;
            arrowButtons.forEach(button => button.appendChild(STYLE));
            // Prevent further execution
            this.hasRendered = true;
        }
        
    }


    @api show({ currentFileIndex, fileExtension, tableFiles, url }) {
        this.initializeShowParams({ currentFileIndex, fileExtension, tableFiles, url });

        this.checkFileType();

        this.updateArrowButtons();
        this.isLoading = true;
        this.showModal = false;

        this.isLoading = false;
        this.showModal = true;
        
    }

    initializeShowParams({ currentFileIndex, fileExtension, tableFiles, url }) {
        this.privateUrl = url;
        this.privateFileExtension = fileExtension;
        this.privateCurrentFileIndex = currentFileIndex;
        this.privateTableFiles = tableFiles;
        this.downloadUrl = window.location.origin + this.privateUrl;
    }

    checkFileType() {
        if (this.privateFileExtension === 'pdf') {
            this.showFrame = true;
            this.isPreviewAvailable = true;
        }
        else if (this.privateFileExtension.match(/(?:jpg|jpeg|png|gif|bmp|svg|tiff)/u)) {
            this.showFrame = false;
            this.isPreviewAvailable = true;
        } else {
            this.showFrame = false;
            this.isPreviewAvailable = false;
        }
    }

    updateArrowButtons() {
        const FIRST_FILE_INDEX = 0;
        this.isPreviousDisabled = this.privateCurrentFileIndex === FIRST_FILE_INDEX;
        this.isNextDisabled = this.privateCurrentFileIndex === this.privateTableFiles.length - LAST_INDEX_OFFSET;
    }

    setModalWidth() {
        const MODAL_WIDTH_RATIO = 0.9, innerWindowWidth = window.innerWidth,
            modalWidth = innerWindowWidth * MODAL_WIDTH_RATIO,
            modalWidthContainer = this.template.querySelector('.responsive-modal');

            if (modalWidthContainer) {
                modalWidthContainer.style.setProperty('--modal-width', `${modalWidth}px`);
            }
    }

    handleNext() {
        if (this.privateCurrentFileIndex < this.privateTableFiles.length - LAST_INDEX_OFFSET) {
            this.privateCurrentFileIndex += 1;
            const currentFile = this.privateTableFiles[this.privateCurrentFileIndex],
                currentFileIndex = this.privateCurrentFileIndex, fileExtension = currentFile.type,
                tableFiles = this.privateTableFiles, url = currentFile.downloadUrl;
            this.show({ currentFileIndex, fileExtension, tableFiles, url });
        }
    }

    handlePrevious() {
        if (this.privateCurrentFileIndex) {
            this.privateCurrentFileIndex -= 1;
            const currentFile = this.privateTableFiles[this.privateCurrentFileIndex],
                currentFileIndex = this.privateCurrentFileIndex, fileExtension = currentFile.type,
                tableFiles = this.privateTableFiles, url = currentFile.downloadUrl;
            this.show({ currentFileIndex, fileExtension, tableFiles, url });
        }
    }

    get modalContentClasses() {
        let additionalClass = 'no-scroll';
        if (this.isPreviewAvailable) {
            additionalClass = 'yes-scroll';
        }
        return `slds-modal__content ${additionalClass}`;
    }

    closeModal() {
        this.showModal = false;
    }
}