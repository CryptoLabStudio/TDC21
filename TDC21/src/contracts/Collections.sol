// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.9.0;

import './Ownable.sol';
import './Priced.sol';
import "../interfaces/ERC721.sol";
import "../interfaces/ERC721Metadata.sol";

contract Collections is Ownable, Priced, ERC721Metadata, ERC721 {

    event CollectionCreated(uint256 collectionId, address owner);

    mapping (address => uint256) public balances;

    struct Collection{
        uint256 id;
        address owner;
        string uri;
    }

    Collection[] collections;

    constructor() {
        price = 100 wei;
        name = "TDC21 Collections";
        symbol = "TDC21C";
    }

    function createCollection(string calldata _uri) external payable cost(price) {
        Collection memory collection;
        collection.id = collections.length;
        collection.owner = msg.sender;
        collection.uri = _uri;
        collections.push(collection);
        balances[msg.sender]++;
        emit CollectionCreated(collections.length - 1, msg.sender);
    }
    
    function collectionsOf(address _address) external view returns(Collection[] memory) {
        Collection[] memory _collections = new Collection[](balances[_address]);
        uint256 count;
        for(uint256 i = 0; i < collections.length; i++) {
            if (collections[i].owner == _address) {
               _collections[count] = collections[i];
               count++;
            }
        }
        
        return _collections;
    }

     function balanceOf(address _address) external override view returns(uint256){
        return balances[_address];
    }

    function ownerOf(uint256 _tokenId) external view override returns(address) {
        return collections[_tokenId].owner;
    }

    // APPROVAL SECTION
    // owner => operator list
    mapping (address => mapping(address => bool)) approvedOperators;
    mapping (uint256 => address) approved;

    function setApprovalForAll(address _operator, bool _approved) external override payable {
        approvedOperators[msg.sender][_operator] = _approved;
        emit ApprovalForAll(msg.sender, _operator, _approved);
    }

    function isApprovedForAll(address _owner, address _operator) external override view returns (bool) {
        return approvedOperators[_owner][_operator];
    }

    function approve(address _approved, uint256 _tokenId) override external payable {
        require(msg.sender == collections[_tokenId].owner || msg.sender == approved[_tokenId]);
        approved[_tokenId] = _approved;
        emit Approval(collections[_tokenId].owner, _approved, _tokenId);
    }

    function getApproved(uint256 _tokenId) override external view returns (address) {
        require(_tokenId < collections.length);
        return approved[_tokenId];
    }

    //=================
    // TRANSFER SECTION
    //=================

    // TODO
    /// When transfer is complete, this function  checks if `_to` is a smart contract (code size > 0).
    /// If so, it calls  `onERC721Received` on `_to` and throws if the return value is not
    ///  `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`.

    modifier transferValidator(address _from, address _to, uint256 _tokenId) {
        require(_tokenId < collections.length);
        require( msg.sender == collections[_tokenId].owner
        || msg.sender == approved[_tokenId]
            || approvedOperators[collections[_tokenId].owner][msg.sender]);
        _;
    }

    function _transfer(address _from, address _to, uint256 _tokenId, bytes memory data) private {
        require(_from == collections[_tokenId].owner);
        collections[_tokenId].owner = _to;
        balances[_from]--;
        balances[_to]++;
        approved[_tokenId] = address(0x0);
        emit Transfer(_from, _to, _tokenId);
    }

    function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes calldata data) override external payable transferValidator(_from, _to, _tokenId) {
        require(_to != address(0x0));
        _transfer(_from, _to, _tokenId, data);
    }

    function safeTransferFrom(address _from, address _to, uint256 _tokenId) override external payable transferValidator(_from, _to, _tokenId) {
        require(_to != address(0x0));
        _transfer(_from, _to, _tokenId, "");
    }

    function transferFrom(address _from, address _to, uint256 _tokenId) override external payable transferValidator(_from, _to, _tokenId) {
        _transfer(_from, _to, _tokenId, "");
    }


    function withdraw() external onlyOwner {
        address payable to = payable(msg.sender);
        to.transfer(address(this).balance);
    }


    //=================
    // ERC721 METADATA
    //=================
    string override public name;
    string override public symbol;

    function tokenURI(uint256 _tokenId) override external view returns (string memory) {
        return collections[_tokenId].uri;
    }
}
