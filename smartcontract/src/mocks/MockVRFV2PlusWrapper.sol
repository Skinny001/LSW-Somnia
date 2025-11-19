// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

contract MockVRFV2PlusWrapper {
    uint256 private requestIdCounter = 1;
    uint256 public constant REQUEST_PRICE = 0.001 ether; // Mock price for testing
    
    struct RequestInfo {
        address requester;
        uint32 callbackGasLimit;
        uint16 requestConfirmations;
        uint32 numWords;
    }
    
    mapping(uint256 => RequestInfo) public requests;
    
    event RandomWordsRequested(
        uint256 indexed requestId,
        address indexed requester,
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords
    );
    
    function calculateRequestPrice(uint32 /* _callbackGasLimit */, uint32 /* _numWords */) external pure returns (uint256) {
        return REQUEST_PRICE;
    }
    
    function calculateRequestPriceNative(uint32 /* _callbackGasLimit */) external pure returns (uint256) {
        return REQUEST_PRICE;
    }
    
    function requestRandomWordsInNative(
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations,
        uint32 _numWords,
        bytes memory _extraArgs
    ) external payable returns (uint256 requestId) {
        require(msg.value >= REQUEST_PRICE, "Insufficient payment");
        
        requestId = requestIdCounter++;
        
        requests[requestId] = RequestInfo({
            requester: msg.sender,
            callbackGasLimit: _callbackGasLimit,
            requestConfirmations: _requestConfirmations,
            numWords: _numWords
        });
        
        emit RandomWordsRequested(
            requestId,
            msg.sender,
            _callbackGasLimit,
            _requestConfirmations,
            _numWords
        );
        
        return requestId;
    }
    
    // Helper function for testing - simulate VRF callback
    function fulfillRandomWords(uint256 requestId, address consumer, uint256[] memory randomWords) external {
        RequestInfo memory request = requests[requestId];
        require(request.requester == consumer, "Invalid consumer");
        
        // Call the consumer's fulfillRandomWords function
        (bool success, ) = consumer.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );
        require(success, "Callback failed");
    }
    
    // Helper function to generate mock random words for testing
    function generateMockRandomWords(uint256 seed, uint32 numWords) external pure returns (uint256[] memory) {
        uint256[] memory randomWords = new uint256[](numWords);
        for (uint32 i = 0; i < numWords; i++) {
            randomWords[i] = uint256(keccak256(abi.encodePacked(seed, i)));
        }
        return randomWords;
    }
    
    // Allow contract to receive native tokens
    receive() external payable {}
}
