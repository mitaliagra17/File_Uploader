const SORT_AFTER = 1, SORT_BEFORE = -1,
closeDeleteModal = function closeDeleteModal(component) {
    component.isDeleteModalOpen = false;
    component.fileToDelete = null;
},
columns = [
    {
        cellAttributes: {
            iconName: { fieldName: 'icon' }
        },
        fieldName: 'fileUrl', 
        label: 'File Name',
        sortable: true,
        type: 'url', 
        typeAttributes: {
            label: { fieldName: 'name' }, 
            target: '_blank' 
        },
    },
    { fieldName: 'type', label: 'Type', sortable: true, type: 'text' },
    { fieldName: 'size', label: 'Size', sortable: true, type: 'text' },
    { fieldName: 'createdDate', label: 'Created Date', sortable: true, type: 'date' },
    { fieldName: 'createdBy', label: 'Created By', sortable: true, type: 'text' },
    {
        fixedWidth: 100, 
        label: 'Actions',
        type: 'action',
        typeAttributes: { 
            rowActions: [
                { iconName: 'utility:preview', label: 'Preview', name: 'viewFile' },
                { iconName: 'utility:download', label: 'Download', name: 'downloadFile' },
                { iconName: 'utility:delete', label: 'Delete', name: 'delete' }
            ]
        }
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
downloadFile = (row) => {
    if (typeof window !== 'undefined'){
        const link = document.createElement('a');
        link.href = row.downloadUrl;
        link.target = '_blank';
        link.download = row.name;
        link.click();
    }
},
filterFiles = function filterFiles(fileDataOriginal, searchKey) {
    if (!searchKey) {
        return fileDataOriginal;
    }

    const lowerCaseSearchKey = searchKey.toLowerCase();

    return fileDataOriginal.filter((file) =>
        file.name.toLowerCase().includes(lowerCaseSearchKey) ||
        file.type.toLowerCase().includes(lowerCaseSearchKey)
    );
},
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
            fileId = file.fields.ContentDocumentId.value,
            fileType = contentDocument.FileExtension.value.toLowerCase();
        return {
            ContentVersionId: contentDocument.LatestPublishedVersionId.value,
            createdBy: contentDocument.CreatedBy.value.fields.Name.value,
            createdDate: contentDocument.CreatedDate.value,
            downloadUrl: `/sfc/servlet.shepherd/document/download/${fileId}`,
            fileUrl: `/lightning/r/ContentDocument/${fileId}/view`,
            icon: getIconName(fileType),
            id: fileId,
            name: contentDocument.Title.value,
            size: formatFileSize(contentDocument.ContentSize.value),
            thumbnailFileCard: `/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${file.fields.ContentDocumentId.value}&operationContext=CHATTER&contentId=${file.fields.ContentDocumentId.value}`,
            type: fileType,
        }
    }).sort((file1, file2) => new Date(file2.createdDate) - new Date(file1.createdDate)),
sortData = (data, sortBy, sortDirection) => {
    const parseFileSize = (sizeStr) => {
    const BYTES_IN_KILOBYTE = 1024, ZERO_VALUE = 0, sizeMatch = sizeStr.match(/^(?<size>\d+(?:\.\d+)?)\s*(?<unit>bytes|KB|MB|GB)$/u), sizeUnitMapping = { "GB": 3, "KB": 1, "MB": 2, "bytes": 0 }, sizeUnitPower = sizeUnitMapping[sizeMatch.groups.unit] || ZERO_VALUE, sizeUnitValue = parseFloat(sizeMatch.groups.size);

    if (!sizeMatch) { return ZERO_VALUE };

    return sizeUnitValue * (BYTES_IN_KILOBYTE ** sizeUnitPower);
},
sortDataHandler = (valA, valB) => {
    const numA = parseFloat(valA), numB = parseFloat(valB);

    if (!isNaN(numA) && !isNaN(numB)) { return numA - numB; }
    return valA.localeCompare(valB);
},
/*eslint max-statements: ["error", 12]*/
sortDataHelper = (valueA, valueB) => {
    const valA = valueA.toString(), valB = valueB.toString();
    if (valueA === null) { return SORT_AFTER; }
    if (valueB === null) { return SORT_BEFORE; }
    if (sortBy === 'name') { return valA.localeCompare(valB); }
    if (sortBy === 'size') { return parseFileSize(valA) - parseFileSize(valB); }
    if (sortBy === 'createdDate') { return new Date(valA) - new Date(valB); }

    return sortDataHandler(valA, valB);
},
    sortedData = [...data].sort((col1, col2) => {
        const valueA = col1[sortBy] || '',
        valueB = col2[sortBy] || '',
        valuesComparison = sortDataHelper(valueA, valueB);

        if(sortDirection === 'asc'){
            return valuesComparison;
        }
        return -valuesComparison;
    });

    return sortedData;
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

export { closeDeleteModal, columns, confirmDelete, contentDocumentFields, downloadFile, filterFiles, initialFileCount, processFileData, sortData, toBase64 };
