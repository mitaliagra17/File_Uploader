/* global sforce */
const INCREAMENT_BY = 1, MAX_ALLOWED_FILE_SIZE = '49073356.8',
createContentVersion = (filename, filecontent, recordId) => {
    const contentVersion = new sforce.SObject('ContentVersion');
    contentVersion.Title = filename;
    contentVersion.PathOnClient = `/${filename}`;
    contentVersion.FirstPublishLocationId = recordId;
    contentVersion.VersionData = filecontent;
    return contentVersion;
},
dispatchMessage = (message) => {
    if (typeof window !== 'undefined') {
        window.parent.postMessage(JSON.stringify(message), "*");
    }
},
handleError = (filename, message) => {
    dispatchMessage({
        filename,
        message,
        status: 'error'
    });
},
handleSuccess = (filename, fileId) => {
    dispatchMessage({
        fileId,
        filename,
        status: 'success'
    });
},
processResult = (result, filename) => {
    if (result.getBoolean("success")) {
        handleSuccess(filename, result.id);
    } else {
        const { errors } = result, errorCode = errors.statusCode || 'UNKNOWN_ERROR';

        if (!errors) {return;}

        if (errorCode === 'STORAGE_LIMIT_EXCEEDED') {
            handleError(filename, 'Storage limit exceeded');
        }
    }
},
uploadContentVersion = function uploadContentVersion(recordId, filename, filecontent) {    
    if (filecontent.length > MAX_ALLOWED_FILE_SIZE) {
        handleError(filename, 'File size too large');
        return;
    }

    const contentVersion = createContentVersion(filename, filecontent, recordId);

    try {
        const results = sforce.connection.create([contentVersion]);
        for (let index = 0; index < results.length; index += INCREAMENT_BY) {
            const result = results[index];
            processResult(result, filename);
        }        
    } catch (exception) {        
        // Handle unexpected JavaScript exceptions
    }
},
uploadMessageHandler = (event) => {
    try {        
            const fileContent = JSON.parse(event.data);            
            uploadContentVersion(
            fileContent.FirstPublishLocationId,
            fileContent.Title,
            fileContent.VersionData
        );
    } catch (error) {
        // This catch block is for unexpected JavaScript errors
    }
};

if (typeof window !== 'undefined') {    
    //Directly assign the message handler
    window.onmessage = uploadMessageHandler;

    // Cleanup by using beforeunload event
    window.onbeforeunload = () => {
        window.onmessage = null;  
    };
}





