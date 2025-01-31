const closeDeleteModal = function closeDeleteModal(component) {
    component.isDeleteModalOpen = false;
    component.fileToDelete = null;
},
columns = [
    {
        cellAttributes: {
            iconName: { fieldName: 'icon' }
        },
        fieldName: 'name',
        label: 'File Name', 
        sortable: true
    },
    { fieldName: 'type', label: 'Type', sortable: true, type: 'text' },
    { fieldName: 'size', label: 'Size', sortable: true, type: 'text' },
    { fieldName: 'createdDate', label: 'Created Date', sortable: true, type: 'date' },
    { fieldName: 'createdBy', label: 'Created By', sortable: true, type: 'text' },
    {
        initialWidth: 75,
        label: 'Delete',
        type: 'button-icon',
        typeAttributes: {
            alternativeText: 'Delete',
            disabled: false,
            iconName: 'utility:delete',
            name: 'delete',
            title: 'Delete',
            variant: 'border-filled'
        }
    },
    {
        label: 'View File',
        resizable: false,
        type: 'button',
        typeAttributes: { label: 'View File', name: 'viewFile', variant: 'base' }  
    }
],
confirmDelete = function confirmDelete(component) {
    if (component.fileToDelete) {
        component.handleDelete(component.fileToDelete);
    }
    component.isDeleteModalOpen = false;
},
contentDocumentFields = [
    'ContentDocumentLink.ContentDocumentId',
    'ContentDocumentLink.ContentDocument.Title',
    'ContentDocumentLink.ContentDocument.ContentSize',
    'ContentDocumentLink.ContentDocument.CreatedById',
    'ContentDocumentLink.ContentDocument.CreatedBy.Name',
    'ContentDocumentLink.ContentDocument.FileExtension',
    'ContentDocumentLink.ContentDocument.CreatedDate',
    'ContentDocumentLink.ContentDocument.LatestPublishedVersionId'
],
formatFileSize = function formatFileSize(sizeInBytes) {
    const BYTES_IN_UNIT = 1024, DECIMAL_PRECISION = 2, INCREMENT_BY = 1,
    SIZE_UNITS = [
        { label: "GB", power: 3 },
        { label: "MB", power: 2 },
        { label: "KB", power: 1 },
        { label: "bytes", power: 0 }
    ];

    for (let index = 0; index < SIZE_UNITS.length; index += INCREMENT_BY) {
        const size = SIZE_UNITS[index], threshold = BYTES_IN_UNIT ** size.power;

        if (sizeInBytes >= threshold) {
            return `${(sizeInBytes / threshold).toFixed(DECIMAL_PRECISION)} ${size.label}`;
        }
    }

    return `${sizeInBytes} bytes`;
},
getIconName = function getIconName(fileType) {
    const fileTypeToIconMap = {
        ai: "doctype:ai",
        avi: "doctype:video",
        bmp: "doctype:image",
        csv: "doctype:csv",
        doc: "doctype:word",
        docx: "doctype:word",
        eps: "doctype:eps",
        exe: "doctype:exe",
        fla: "doctype:flash",
        gdoc: "doctype:gdoc",
        gif: "doctype:image",
        html: "doctype:html",
        jpeg: "doctype:image",
        jpg: "doctype:image",
        key: "doctype:keynote",
        mov: "doctype:video",
        mp3: "doctype:audio",
        mp4: "doctype:mp4",
        pdf: "doctype:pdf",
        pgs: "doctype:pages",
        png: "doctype:image",
        ppt: "doctype:ppt",
        pptx: "doctype:ppt",
        psd: "doctype:psd",
        rtf: "doctype:rtf",
        svg: "doctype:image",
        tiff: "doctype:image",
        txt: "doctype:txt",
        vis: "doctype:visio",
        wmv: "doctype:video",
        xls: "doctype:excel",
        xlsx: "doctype:excel",
        xml: "doctype:xml",
        zip: "doctype:zip",
    };

    return fileTypeToIconMap[fileType] || "doctype:unknown";
},
initialFileCount = 0,
processFileData = (records) =>
    records.map((file) => {
        const contentDocument = file.fields.ContentDocument.value.fields,
            fileType = contentDocument.FileExtension.value.toLowerCase();
        return {
            ContentVersionId: contentDocument.LatestPublishedVersionId.value,
            createdBy: contentDocument.CreatedBy.value.fields.Name.value,
            createdDate: contentDocument.CreatedDate.value,
            downloadUrl: `/sfc/servlet.shepherd/document/download/${file.fields.ContentDocumentId.value}`,
            icon: getIconName(fileType),
            id: file.fields.ContentDocumentId.value,
            name: contentDocument.Title.value,
            size: formatFileSize(contentDocument.ContentSize.value),
            thumbnailFileCard: `/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${file.fields.ContentDocumentId.value}&operationContext=CHATTER&contentId=${file.fields.ContentDocumentId.value}`,
            type: fileType,
        };
    }),
sortData = (data, sortBy, sortDirection) => {
    const EQUAL = 0,
        GREATER = 1,
        LESS = -1,

    compareValues = (valueA, valueB) => {
        if (typeof valueA === 'string') {
            return valueA.localeCompare(valueB);
        } else if (typeof valueA === 'number' || valueA instanceof Date) {
            if (valueA > valueB) {return GREATER};
            if (valueA < valueB) {return LESS};
        }
        return EQUAL;
    };

    return [...data].sort((col1, col2) => {
        const valueA = col1[sortBy] || '',
            valueB = col2[sortBy] || '',
            valuesComparison = compareValues(valueA, valueB);

            if (sortDirection === 'asc') {
                return valuesComparison;
            } 
            return -valuesComparison;
    });
},
toBase64 = function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = 'base64,', content = reader.result.indexOf(base64) + base64.length,
                fileContents = reader.result.substring(content);
            resolve(fileContents);
        };
        reader.onerror = error => reject(error);
    });
};

export { closeDeleteModal, columns, confirmDelete, contentDocumentFields, initialFileCount, processFileData, sortData, toBase64 };