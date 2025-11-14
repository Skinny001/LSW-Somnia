// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../rewarder.sol";

contract MockRewarder is Rewarder {
    
    constructor(
        address _lswContract,
        address _vrfWrapper
    ) Rewarder(_lswContract, _vrfWrapper) {}
    
    // Public wrapper for testing
    function testFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        fulfillRandomWords(requestId, randomWords);
    }
}
