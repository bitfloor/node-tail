
// builtin
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

// 3rd party
var carrier = require('carrier');

/// setup a new path to watch
/// return an event emitter
/// emits: data, error, truncated
function watch(path) {
    var _fd;

    // circular buffer to read data into
    var buffer = new Buffer(1024);
    var emitter = new EventEmitter();

    var pause = false;

    emitter.pause = function() {
        pause = true;
    };

    emitter.resume = function() {
        pause = false;
        read_data();
    };

    emitter.close = function() {
        fs.unwatchFile(path);
        fs.close(_fd);
    };

    // noop, up to consumer to deal with it
    emitter.setEncoding = function(enc) {
    };

    // where to read the file from
    var offset = 0;

    // when set to true if we are already reading the file
    // we should not start reading again until the current read is done
    // that will cause the line readers to shit themselves
    var reading = false;

    // read data from the new position
    // callback when done reading
    function read_data() {
        if (reading || pause) {
            return;
        }
        reading = true;

        fs.read(_fd, buffer, 0, buffer.length, offset, function(err, bytesRead, buff) {
            if (err) {
                emitter.emit('error', err);
                return cb();
            }

            emitter.emit('data', buff.slice(0, bytesRead));
            offset += bytesRead;

            // if we read the full buffer, reread again
            if (bytesRead === buffer.length) {
                // set reading to false so we can call outselves again
                // this is safe because only one thread exists and
                // there is no one else who will call read_data before we do
                reading = false;
                return read_data();
            } else {
                // done reading and will not read again
                return reading = false;
            }
        });
    }

    // open the file to read initial contents
    fs.open(path, 'r', function(err, fd) {
        if (err) {
            emitter.emit('error', err);
            return;
        }
        _fd = fd;

        // perform the initial file read
        read_data();

        // we can start watching the file right away
        // any read_data calls will be ignored
        fs.watchFile(path, function(curr, prev) {

            // file was removed
            if (curr.nlink === 0) {
                return;
            }

            // nothing changed
            if(curr.size == prev.size) {
                return;
            }

            // if prev nlink is 0, the file was freshly created
            // nodejs doesn't reset the size field so it has some large number
            // this will cause us to think it was truncated
            if (prev.nlink === 0) {
                prev.size = 0;
                emitter.emit('created');
            }

            // file was truncated, not appended to
            if(curr.size < prev.size) {
                return emitter.emit('truncated');
            }

            // attempt to read some data
            read_data();
        });
    });

    return emitter;
}
module.exports.watch = watch;

function create_line_feed(path, cb) {
    var emitter = watch(path);
    var messenger = carrier.carry(emitter);
    messenger.on('line', function(line) {
        emitter.emit('line', line);
    });

    // if we had a callback, hook it up to receive line events
    if (cb) {
        emitter.on('line', cb);
    }
    return emitter;
};
module.exports.create_line_feed = create_line_feed;

