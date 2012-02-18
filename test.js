var fs = require('fs');

var tail = require('./tail');

var test_filename = __dirname + '/test_filename.txt';

module.exports.watch = {
    setUp: function(cb) {
        var self = this;
        self.fd = fs.openSync(test_filename, 'a');
        self.watch = tail.watch(test_filename);
        cb();
    },
    tearDown: function(cb) {
        var self = this;
        fs.closeSync(self.fd);
        fs.unlinkSync(test_filename);
        cb();
    },
    data: function(test) {
        var self = this;
        self.watch.on('data', function(chunk) {
            test.equal('test data', chunk.toString());
            test.done();
            self.watch.close();
        });
        fs.writeSync(self.fd, 'test data', 0);
    },
}

module.exports.lines = {
    setUp: function(cb) {
        var self = this;
        self.fd = fs.openSync(test_filename, 'a');
        self.watch = tail.create_line_feed(test_filename);
        cb();
    },
    tearDown: function(cb) {
        var self = this;
        fs.closeSync(self.fd);
        fs.unlinkSync(test_filename);
        cb();
    },
    data: function(test) {
        var self = this;
        self.watch.on('line', function(line) {
            test.equal('test line', line);
            test.done();
            self.watch.close();
        });
        fs.writeSync(self.fd, 'test line\nnone', 0);
    },
}

