var Promise = require('bluebird');
var Web3    = require('web3');
var solc    = require('solc');
var fs      = require('fs');

var args = process.argv.slice(2);

if (args.length != 3) {
    console.log('\n\tSyntax: deploy.js <contract file> <contract name> <result file>\n');
    return;
}

var CONTRACT_FILE = args[0];
var CONTRACT_NAME = args[1];
var RESULT_FILE = args[2];

var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));

var readfs  = Promise.promisify(fs.readFile);
var writefs = Promise.promisify(fs.writeFile);
var sendtx  = Promise.promisify(web3.eth.sendTransaction);

var inputs = {};
var results = {};

console.log('Compiling contract...');
readfs(CONTRACT_FILE, 'utf8')
.then(function(data) {
    inputs[CONTRACT_NAME + '.sol'] = data;
    return compile();
})
.then(function(data) {
    results.abi = data.contracts[CONTRACT_NAME].interface;
    console.log('Contracts compiled successfully.');
    console.log('Deploying...');
    return deploy(data);
})
.then(function(tx) {
    return getTransactionReceipt(tx);
})
.then(function(receipt) {
    results.address = receipt.contractAddress;
    console.log('Contract deployed at ' + receipt.contractAddress);
    console.log('Saving result file...');
    return writefs(RESULT_FILE, buildFileContent());
})
.then(function() {
    console.log('Results file created.');
})
.catch(function(err) {
    console.log(err);
    throw err;
});

function compile() {
    return new Promise(function(resolve, reject) {
        var data = solc.compile({sources: inputs}, 0);
        if (data.errors != null) {
            reject(data.errors);
            return;
        }
        resolve(data);
    });
}

function deploy(data) {
    var transaction = {
        from: web3.eth.coinbase,
        data: data.contracts[CONTRACT_NAME].bytecode,
        gas: 3141592,
        gasPrice: Math.pow(10, 12)
    };
    return sendtx(transaction);
}

function buildFileContent() {
    return
        'var abi = \'' + JSON.stringify(results.abi) + '\';\n\n' +
        'var address = \'' + results.address + '\';\n\n' +
        'module.exports = {abi:abi, address:address};\n';

}

function getTransactionReceipt(hash) {
    var getReceipt = Promise.promisify(web3.eth.getTransactionReceipt);
    return new Promise(function(resolve, reject) {
        var interval = setInterval(function() {
            getReceipt(hash)
            .then(function(receipt) {
                if (receipt != null) {
                    clearInterval(interval);
                    resolve(receipt);
                } else {
                    //console.log('Waiting for the contract to be mined...');
                }
            })
            .catch(function(err) {
                reject(err);
            });
        }, 1000);
    });
}
