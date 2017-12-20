var MediaInfoOnline = (function () {
    var MediaInfoModule, MI, filename, processing = false, CHUNK_SIZE = 1024 * 1024;

    // Initialize emscripten module
    var init = function(memFile) {
        var locateFile = function() {
          return memFile;
        };

        MediaInfoModule = MediaInfoLib({'locateFile': locateFile, 'postRun': function() {
            initPage();
        }});
    };

    // Page init
    var initPage = function() {
        // Format list
        var formatList = JSON.parse(MediaInfoModule.MediaInfo.Option_Static('Info_OutputFormats_JSON'));
        $.each(formatList.output, function(key, format) {
            // Change format list
            $('#mediainfo-format-list').append($('<option>', { value: format.name, mime: format.mime }).text(format.desc));

            // Download format list
            $('.mediainfo-format-list-download-container ul').append(
                '<li data-format="' + format.name + '" data-mime="' + format.mime + '"><a href="#">' + format.desc + '</a></li>'
            );
        });

        bindings();

        $('div.mediainfo-loader').remove();
        $('div.mediainfo-container').removeClass('hidden');
    };

    var bindings = function() {
        // Change output format
        $('#mediainfo-format-list').on('change', function() {
            if (processing) {
                changeOutputFormat($(this).val(), $(this).find(':selected').attr('mime'));
            }
        });

        // Download report format
        $('.mediainfo-format-list-download-container ul li').on('click', function(e) {
            e.preventDefault();

            if (processing) {
                downloadReport(e.currentTarget.getAttribute('data-format'), e.currentTarget.getAttribute('data-mime'));
            }
        });

        // Download report
        $('.mediainfo-format-list-download').on('click', function(e) {
            e.preventDefault();

            if (processing) {
                if ($('#mediainfo-format-list :selected').length) {
                    var format = $('#mediainfo-format-list :selected').val();
                    var mime = $('#mediainfo-format-list :selected').attr('mime');
                } else {
                    var format = 'Text';
                    var mime = 'text/plain';
                }
                downloadReport(format, mime);
            }
        });

        // File input
        $('#mediainfo-file-input').on('change', function() {
            var input = $(this)[0];
            if(input.files.length > 0) {
                processFile(input.files[0]);
            }
        });

        dragAndDropBinding();
    };

    var dragAndDropBinding = function() {
        $('.mediainfo-file-drop').on('dragover dragenter', function(e){
            e.preventDefault();
            e.stopPropagation();
            $(this).css('border', '3px dashed #0070bb');
        });

        $('.mediainfo-file-drop').on('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).css('border', '3px dashed #e7e7e7');
        });

        $('.mediainfo-file-drop').on('drop', function(e) {
            var dt = e.originalEvent.dataTransfer;
            if(dt){
                if (dt.items && dt.items[0] && dt.items[0].kind == "file") {
                    e.preventDefault();
                    e.stopPropagation();

                    processDragFile(dt.items[0].getAsFile());
                }
                else if(dt.files.length) {
                    e.preventDefault();
                    e.stopPropagation();

                    processDragFile(dt.files[0]);
                }
            }
            else {
                $(this).css('border', '3px dashed #e7e7e7');
            }
        });
    };

    var finish = function() {
        MI.Close();
        MI.delete;
        processing = false;
    };

    // parseFile callback
    var showResult = function(file) {
        var mime = 'text/plain';
        if ($('#mediainfo-format-list').val()) {
            MI.Option('Inform', $('#mediainfo-format-list').val());
            mime = $('#mediainfo-format-list :selected').attr('mime');
        }

        $('.mediainfo-report-filename').text(file.name);
        $('.mediainfo-report-filename-container').removeClass('hidden');

        displayReport(mime);
        $('.mediainfo-report-container').removeClass('hidden');
        $('.mediainfo-format-list-download-container').removeClass('hidden');
    };

    // Change output format
    var changeOutputFormat = function(format, mime) {
        MI.Option('Inform', format);
        displayReport(mime);
    };

    // Display the report
    var displayReport = function(mime) {
        switch(mime) {
            case 'text/html':
                $('#mediainfo-report').html(sanitizeHtmlReport(MI.Inform()));
                break;
            case 'text/xml':
                $('#mediainfo-report').text(MI.Inform());
                break;
            case 'text/json':
                $('#mediainfo-report').text(MI.Inform());
                break;
            default:
                $('#mediainfo-report').text(MI.Inform());
        }
        $('.mediainfo-report-error').addClass('hidden')
        $('#mediainfo-report').removeClass();
        hljs.highlightBlock($('#mediainfo-report')[0]);
    };

    // Sanitize HTML report
    var sanitizeHtmlReport = function(report) {
        report = report.replace(/width="150"/ig, 'width="50%"');
        report = report.replace(/colspan="3"/ig, '');
        report = report.replace(/border:1px solid Navy/ig, 'border:1px solid #0070bb');

        return report;
    };

    // Download report
    var downloadReport = function(format, mime) {
        try {
            var isFileSaverSupported = !!new Blob;
        } catch (e) {
            displayError('Your browser is not compatible. Please update your browser or use another browser.')
        }

        MI.Option('Inform', format);
        var blob = new Blob([MI.Inform()], {type: mime + ';charset=utf-8'});
        saveAs(blob, getReportFilename(format, mime));
    };

    // Get file extension
    var getFileExtensionFromMimeType = function(mime) {
        switch(mime) {
            case 'text/html':
                return 'html';
                break;
            case 'text/xml':
                return 'xml';
                break;
            case 'text/json':
                return 'json';
                break;
            default:
                return 'txt';
        }
    };

    // Get report filename
    var getReportFilename = function(format, mime) {
        var reportFilename = filename + '_MediaInfo';
        var standardReport = ['XML', 'MIXML', 'Text', 'HTML'];
        if (standardReport.indexOf(format) === -1) {
            reportFilename += '.' + format;
        }

        return reportFilename + '.' + getFileExtensionFromMimeType(mime);
    };

    //Display error message
    var displayError = function(error) {
        $('.mediainfo-report-error').text(error);
        $('.mediainfo-report-container').addClass('hidden');
        $('.mediainfo-format-list-download-container').addClass('hidden');
        $('.mediainfo-report-filename-container').addClass('hidden');
        $('.mediainfo-report-error').removeClass('hidden')
    };

    // Process dragged file
    var processDragFile = function(file) {
        $('.mediainfo-file-drop').css('border', '3px dashed #01d318');

        processFile(file);
    }

    // Process file
    var processFile = function(file) {
        // Analyze file
        $('#mediainfo-report').text('Processing...');
        if (processing) {
            finish();
        }

        try {
            parseFile(file, showResult);
        } catch (e) {
            displayError('Your browser is not compatible.')
        }
    }

    // Analyze file
    var parseFile = function(file, callback) {
        if (processing) {
            return;
        }
        processing = true;
        filename = file.name;

        var offset = 0;

        // Initialise MediaInfo
        MI = new MediaInfoModule.MediaInfo();

        MI.Option('File_FileName', file.name);
        MI.Open_Buffer_Init(file.size, 0);

        var loop = function(length) {
            if (processing) {
                var r = new FileReader();
                var blob = file.slice(offset, offset + length);
                r.onload = processChunk;
                r.readAsArrayBuffer(blob);
            } else {
                finish()
            }
        };

        var processChunk = function(e) {
            if (e.target.error === null) {
                // Send the buffer to MediaInfo
                try {
                    var state = MI.Open_Buffer_Continue(e.target.result);

                } catch(e) {
                    finish();
                    displayError('An error happened reading your file.');
                    return;
                }

                //Test if there is a MediaInfo request to go elsewhere
                var seekTo = MI.Open_Buffer_Continue_Goto_Get();
                if(seekTo === -1) {
                    offset += e.target.result.byteLength;
                } else {
                    offset = seekTo;
                    MI.Open_Buffer_Init(file.size, seekTo); // Inform MediaInfo we have seek
                }
            } else {
                finish();
                displayError('An error happened reading your file.');
                return;
            }

            // Bit 3 set means finalized
            if (state&0x08 || e.target.result.byteLength < 1) {
                MI.Open_Buffer_Finalize();
                callback(file);
                return;
            }

            loop(CHUNK_SIZE);
        };

        // Start
        loop(CHUNK_SIZE);
    };

    return {
        init: init,
    };
});