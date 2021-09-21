require('chai').use(require('chai-as-promised')).should()

const { Emitted } = require('./helpers/events.js')
const { ethBalance, weiBalance } = require('./helpers/balance.js')
const { assert } = require('chai')

const CollectionsNFT = artifacts.require("CollectionsNFT")

const CREATE_CONTRACT_COST = 100

const errorMessage = 'VM Exception while processing transaction: revert'
const deadAddress = "0x0000000000000000000000000000000000000000"

contract('CollectionsNFT', (accounts) => {
    let instance;
    beforeEach(async () => {
        instance = await CollectionsNFT.deployed();
    })

    describe('deployment', () => {
        it('deploys successfully', async () => {
            assert.notEqual(instance.address, '')
            assert.notEqual(instance.address, 0x0)
            assert.notEqual(instance.address, undefined)
            assert.notEqual(instance.address, null)
            assert.equal(await ethBalance(instance.address), 0)
        })
    })

    describe('ERC721Metadata', () => {
        it('check name and symbol', async () => {
            assert.equal(await instance.symbol(), "TDC21C")
            assert.equal(await instance.name(), "TDC21 Collections")
        });
    })

    describe('balanceOf', () => {
        it('initial balance is 0', async () => {
            assert.equal(await instance.balanceOf(accounts[0]), 0)
        })
    })

    describe('create collection', () => {
        it('error when no dinero amigo', async () => {
            await instance.createCollection("anUri").should.be.rejectedWith(errorMessage)
        });

        it('collection created', async () => {
            const balance = await weiBalance(instance.address)
            assert.equal(balance, 0)

            const result = await instance.createCollection("anUri", { value: CREATE_CONTRACT_COST })

            assert.equal(await instance.tokenURI(0), 'anUri')
            assert.equal(await instance.ownerOf(0), accounts[0])
            assert.equal(await instance.balanceOf(accounts[0]), 1)
            assert.equal(await weiBalance(instance.address), balance + CREATE_CONTRACT_COST)

            Emitted(result, 'CollectionCreated', {
                collectionId: 0,
                owner: accounts[0]
            }, 'Contract should return the correct event.');
        })

        it('balance rises when a nft is created', async () => {
            assert.equal(await instance.balanceOf(accounts[0]), 1)
        })
    })

    describe('cost', () => {
        it('cant update cost if not owner', async () => {
            assert.equal(await instance.price(), CREATE_CONTRACT_COST)
            await instance.updatePrice(200, { from: accounts[4] }).should.be.rejectedWith(errorMessage);
            assert.equal(await instance.price(), CREATE_CONTRACT_COST)
        })

        it('cost is updated', async () => {
            assert.equal(await instance.price(), CREATE_CONTRACT_COST)
            const result = await instance.updatePrice(200, { from: accounts[0] });
            assert.equal(await instance.price(), 200)
        
            Emitted(result, 'PriceUpdated', {
                newPrice: 200,
            }, 'Contract should return the correct event.');

            await instance.updatePrice(CREATE_CONTRACT_COST, { from: accounts[0] });
        })
    });

    describe('Approval', () => {
        it('Should return 0x0 address if no approved yet', async () => {
            assert.equal(await instance.getApproved(0), 0)
        })

        it('Should throw if NFT doesnt exist', async () => {
            await instance.getApproved(7438).should.be.rejectedWith(errorMessage);
        })

        it('Should throw if sender is not owner or approved', async () => {
            await instance.approve(accounts[1], 0, { from: accounts[7] }).should.be.rejectedWith(errorMessage)
        })

        it('Approve collection as owner and getApproved', async () => {
            assert.equal(await instance.getApproved(0), 0)

            const result = await instance.approve(accounts[1], 0)
            Emitted(result, 'Approval', {
                _owner: accounts[0],
                _approved: accounts[1],
                _tokenId: 0,
            }, 'Contract should return the correct event.');

            assert.equal(await instance.getApproved(0), accounts[1])
        })

        it('Approve if sender is not owner but is approved', async () => {
            const result = await instance.approve(accounts[2], 0, {from: accounts[1]})
            Emitted(result, 'Approval', {
                _owner: accounts[0],
                _approved: accounts[2],
                _tokenId: 0,
            }, 'Contract should return the correct event.');
            assert.equal(await instance.getApproved(0), accounts[2])
        })

        it('Approved that approves losses approval', async () => {
            await instance.approve(accounts[2], 0, {from: accounts[1]}).should.be.rejectedWith(errorMessage)
        })

        it('Owner that approved can change approved wallet', async () => {
            const result = await instance.approve(accounts[3], 0, {from: accounts[0]})
            Emitted(result, 'Approval', {
                _owner: accounts[0],
                _approved: accounts[3],
                _tokenId: 0,
            }, 'Contract should return the correct event.');
            assert.equal(await instance.getApproved(0), accounts[3])
        })

        describe('ApprovalForAll tests', () => {
            it('account[2] is not an operator for account[1]', async () => {
                const result = await instance.isApprovedForAll(accounts[1], accounts[2]);
                assert.equal(result, false);
            })

            it('approve an operator', async () => {
                const result = await instance.setApprovalForAll(accounts[2], true, {from: accounts[1]})
                Emitted(result, 'ApprovalForAll', {
                    _owner: accounts[1],
                    _operator: accounts[2],
                    _approved: true,
                }, 'Contract should return the correct event.');
                
                assert.equal(await instance.isApprovedForAll(accounts[1], accounts[2]), true);
            })

            it('revoke operator', async () => {
                const result = await instance.setApprovalForAll(accounts[2], false, {from: accounts[1]})
                Emitted(result, 'ApprovalForAll', {
                    _owner: accounts[1],
                    _operator: accounts[2],
                    _approved: false,
                }, 'Contract should return the correct event.');
                
                assert.equal(await instance.isApprovedForAll(accounts[1], accounts[2]), false);
            })
        })

        describe('safeTransferFrom tests', () => {

            before(async () => {
                await instance.createCollection("anUri", { value: CREATE_CONTRACT_COST })
            })

            describe('test is not owner, approved or operator', () => {

                it('test not owner, approved nor operator', async () => {
                    await instance.safeTransferFrom(accounts[0], accounts[3], 1, {from: accounts[1]}).should.be.rejectedWith(errorMessage)
                })
                it('_to 0 should be rejected', async () => {
                    await instance.safeTransferFrom(accounts[0], deadAddress, 1).should.be.rejectedWith(errorMessage)
                })
                it('nft doesnt exist', async () => {
                    await instance.safeTransferFrom(accounts[0], accounts[3], 5).should.be.rejectedWith(errorMessage);
                })
                it('should reject when _from is not owner', async () => {
                    await instance.safeTransferFrom(accounts[1], accounts[7], 1).should.be.rejectedWith(errorMessage)
                })
            })

            describe('happy path', () => {
                it('is safely transferred when owner is msg sender', async () => {
                    assert.equal(await instance.balanceOf(accounts[0]), 2)
                    assert.equal(await instance.balanceOf(accounts[3]), 0)
                    await instance.approve(accounts[4], 1);

                    const result = await instance.safeTransferFrom(accounts[0], accounts[3], 1);
                    assert.equal(await instance.ownerOf(1), accounts[3])

                    assert.equal(await instance.balanceOf(accounts[0]), 1)
                    assert.equal(await instance.balanceOf(accounts[3]), 1)
                    assert.equal(await instance.getApproved(1), 0)

                    Emitted(result, 'Transfer', {
                        _from: accounts[0],
                        _to: accounts[3],
                        _tokenId: 1,
                    }, 'Contract should return the correct event.');
                })
            })
        })

        describe('safeTransferFrom with DATA tests', () => {
            //
            // before(async () => {
            //     await instance.createCollection("anUri", { value: CREATE_CONTRACT_COST })
            // })
            //
            // describe('test is not owner, approved or operator', () => {
            //
            //     it('test not owner, approved nor operator', async () => {
            //         await instance.safeTransferFrom(accounts[0], accounts[3], 1, {from: accounts[1]}).should.be.rejectedWith(errorMessage)
            //     })
            //     it('_to 0 should be rejected', async () => {
            //         await instance.safeTransferFrom(accounts[0], deadAddress, 1).should.be.rejectedWith(errorMessage)
            //     })
            //     it('nft doesnt exist', async () => {
            //         await instance.safeTransferFrom(accounts[0], accounts[3], 5).should.be.rejectedWith(errorMessage);
            //     })
            //     it('should reject when _from is not owner', async () => {
            //         await instance.safeTransferFrom(accounts[1], accounts[7], 1).should.be.rejectedWith(errorMessage)
            //     })
            // })
            //
            // describe('happy path', () => {
            //     it('is safely transferred when owner is msg sender', async () => {
            //         assert.equal(await instance.balanceOf(accounts[0]), 2)
            //         assert.equal(await instance.balanceOf(accounts[3]), 0)
            //         await instance.approve(accounts[4], 1);
            //
            //         let result = await instance.safeTransferFrom(accounts[0], accounts[3], 1);
            //         assert.equal(await instance.ownerOf(1), accounts[3])
            //
            //         assert.equal(await instance.balanceOf(accounts[0]), 1)
            //         assert.equal(await instance.balanceOf(accounts[3]), 1)
            //         assert.equal(await instance.getApproved(1), 0)
            //
            //         Emitted(result, 'Transfer', {
            //             _from: accounts[0],
            //             _to: accounts[3],
            //             _tokenId: 1,
            //         }, 'Contract should return the correct event.');
            //     })
            // })
        })

        describe('transferFrom tests', () => {

            before(async () => {
                await instance.createCollection("anUri", { value: CREATE_CONTRACT_COST })
            })

            describe('test is not owner, approved or operator', () => {

                it('test not owner, approved nor operator', async () => {
                    await instance.safeTransferFrom(accounts[0], accounts[3], 2, {from: accounts[1]}).should.be.rejectedWith(errorMessage)
                })

                it('nft doesnt exist', async () => {
                    await instance.safeTransferFrom(accounts[0], accounts[3], 5).should.be.rejectedWith(errorMessage);
                })
                it('should reject when _from is not owner', async () => {
                    await instance.safeTransferFrom(accounts[1], accounts[7], 2).should.be.rejectedWith(errorMessage)
                })
            })

            describe('Transfer', () => {
                it('is safely transferred when owner is msg sender', async () => {
                    assert.equal(await instance.balanceOf(accounts[0]), 2)
                    assert.equal(await instance.balanceOf(accounts[5]), 0)

                    const result = await instance.transferFrom(accounts[0], accounts[5], 2);
                    assert.equal(await instance.ownerOf(2), accounts[5])

                    assert.equal(await instance.balanceOf(accounts[0]), 1)
                    assert.equal(await instance.balanceOf(accounts[5]), 1)

                    Emitted(result, 'Transfer', {
                        _from: accounts[0],
                        _to: accounts[5],
                        _tokenId: 2,
                    }, 'Contract should return the correct event.');
                })
                
                it('burn', async () => {
                    assert.equal(await instance.balanceOf(accounts[5]), 1)
                    assert.equal(await instance.balanceOf('0x0000000000000000000000000000000000000000'), 0)

                    const result = await instance.transferFrom(accounts[5], '0x0000000000000000000000000000000000000000', 2, { from: accounts[5]});
                    assert.equal(await instance.ownerOf(2), 0)

                    assert.equal(await instance.balanceOf(accounts[5]), 0)

                    Emitted(result, 'Transfer', {
                        _from: accounts[5],
                        _to: 0,
                        _tokenId: 2,
                    }, 'Contract should return the correct event.');
                })
            })
        })
    })
})

