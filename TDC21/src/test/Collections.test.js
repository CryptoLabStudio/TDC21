require('chai').use(require('chai-as-promised')).should()

const Collections = artifacts.require("Collections")

const { Emitted } = require('./helpers/events')
const { weiBalance } = require('./helpers/balance')
const { DEAD_ADDRESS, ERROR_MESSAGE, CREATE_CONTRACT_COST } = require('./utils/constants')



contract('Collections', (accounts) => {

    let instance;
    beforeEach(async () => {
        instance = await Collections.new();
        await instance.createCollection("anUri", { value: CREATE_CONTRACT_COST })
    })

    describe('deployment', () => {
        it('deploys successfully', async () => {
            assert.notEqual(instance.address, '')
            assert.notEqual(instance.address, 0x0)
            assert.notEqual(instance.address, undefined)
            assert.notEqual(instance.address, null)
            assert.equal(await weiBalance(instance.address), CREATE_CONTRACT_COST)
            assert.equal(await instance.name(), 'TDC21 Collections')
            assert.equal(await instance.symbol(), 'TDC21C')
        })
    })

    describe('createCollection', () => {
        it('error when no dinero amigo', async () => {
            await instance.createCollection("anUri").should.be.rejectedWith(ERROR_MESSAGE)
        });

        it('collection created', async () => {
            const balance = await weiBalance(instance.address)
            assert.equal(balance, CREATE_CONTRACT_COST)

            const result = await instance.createCollection("anUri2", { value: CREATE_CONTRACT_COST })

            assert.equal(await instance.tokenURI(1), 'anUri2')
            assert.equal(await instance.ownerOf(1), accounts[0])
            assert.equal(await instance.balanceOf(accounts[0]), 2)
            assert.equal(await weiBalance(instance.address), balance + CREATE_CONTRACT_COST)

            Emitted(result, 'CollectionCreated', {
                collectionId: 1,
                owner: accounts[0]
            }, 'Contract should return the correct event.');
        })
    })

    describe('collectionsOf', () => {
        it('Should return empty if address doesnt have any collection', async () => {
            const result = await instance.collectionsOf.call(accounts[8]);
            assert.isOk(Array.isArray(result));
            assert.equal(result.length, 0);
        })

        it('Should return array of collections if address have collections', async () => {
            await instance.createCollection('collection2', { value: CREATE_CONTRACT_COST });
            const result = await instance.collectionsOf.call(accounts[0]);
            assert.isOk(Array.isArray(result));
            assert.equal(result.length, 2);
            result.forEach((r, i) => {
                assert.equal(r.id, i);
                assert.equal(r.owner, accounts[0]);
                assert.equal(r.uri, ['anUri', 'collection2'][i]);
            });
        })
    })

    describe('balanceOf', () => {
        it('initial balance is 1', async () => {
            const result = await instance.balanceOf(accounts[0])
            assert.equal(result, 1)
        })

        it('updates balance when new collection is created', async () => {
            let result = await instance.balanceOf(accounts[0])
            assert.equal(result, 1)
            await instance.createCollection("anUri2", { value: CREATE_CONTRACT_COST })
            result = await instance.balanceOf(accounts[0])
            assert.equal(result, 2)
        })
    })

    describe('cost', () => {
        it('cant update cost if not owner', async () => {
            assert.equal(await instance.price(), CREATE_CONTRACT_COST)
            await instance.updatePrice(200, { from: accounts[4] }).should.be.rejectedWith(ERROR_MESSAGE);
            assert.equal(await instance.price(), CREATE_CONTRACT_COST)
        })

        it('cost is updated', async () => {
            const NEW_PRICE = 200
            assert.equal(await instance.price(), CREATE_CONTRACT_COST)
            const result = await instance.updatePrice(NEW_PRICE, { from: accounts[0] })
            assert.equal(await instance.price(), NEW_PRICE)
        
            Emitted(result, 'PriceUpdated', {
                newPrice: NEW_PRICE,
            }, 'Contract should return the correct event.');

            await instance.createCollection("anUri", { value: CREATE_CONTRACT_COST }).should.be.rejectedWith(ERROR_MESSAGE)
        })
    });

    describe('Approval', () => {
        it('Should return 0x0 address if no approved yet', async () => {
            assert.equal(await instance.getApproved(0), 0)
        })

        it('Should throw if NFT doesnt exist', async () => {
            await instance.getApproved(7438).should.be.rejectedWith(ERROR_MESSAGE);
        })

        it('Should throw if sender is not owner or approved', async () => {
            await instance.approve(accounts[1], 0, { from: accounts[7] }).should.be.rejectedWith(ERROR_MESSAGE)
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
            await instance.approve(accounts[1], 0)
            const result = await instance.approve(accounts[2], 0, {from: accounts[1]})
            Emitted(result, 'Approval', {
                _owner: accounts[0],
                _approved: accounts[2],
                _tokenId: 0,
            }, 'Contract should return the correct event.');
            assert.equal(await instance.getApproved(0), accounts[2])
        })

        it('Approved that approves losses approval', async () => {
            await instance.approve(accounts[2], 0, {from: accounts[1]}).should.be.rejectedWith(ERROR_MESSAGE)
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
            describe('test is not owner, approved or operator', () => {

                it('test not owner, approved nor operator', async () => {
                    await instance.safeTransferFrom(accounts[0], accounts[3], 0, {from: accounts[1]}).should.be.rejectedWith(ERROR_MESSAGE)
                })
                it('_to 0 should be rejected', async () => {
                    await instance.safeTransferFrom(accounts[0], DEAD_ADDRESS, 0).should.be.rejectedWith(ERROR_MESSAGE)
                })
                it('nft doesnt exist', async () => {
                    await instance.safeTransferFrom(accounts[0], accounts[3], 5).should.be.rejectedWith(ERROR_MESSAGE);
                })
                it('should reject when _from is not owner', async () => {
                    await instance.safeTransferFrom(accounts[1], accounts[7], 0).should.be.rejectedWith(ERROR_MESSAGE)
                })
            })

            describe('happy path', () => {
                it('is safely transferred when owner is msg sender', async () => {
                    assert.equal(await instance.balanceOf(accounts[0]), 1)
                    assert.equal(await instance.balanceOf(accounts[3]), 0)
                    await instance.approve(accounts[4], 0)

                    const result = await instance.safeTransferFrom(accounts[0], accounts[3], 0);
                    assert.equal(await instance.ownerOf(0), accounts[3])

                    assert.equal(await instance.balanceOf(accounts[0]), 0)
                    assert.equal(await instance.balanceOf(accounts[3]), 1)
                    assert.equal(await instance.getApproved(0), 0)

                    Emitted(result, 'Transfer', {
                        _from: accounts[0],
                        _to: accounts[3],
                        _tokenId: 0,
                    }, 'Contract should return the correct event.');
                })
            })
        })

        describe('safeTransferFrom with DATA tests', () => {
            // TODO
            // ...
        })

        describe('transferFrom tests', () => {
            describe('test is not owner, approved or operator', () => {

                it('test not owner, approved nor operator', async () => {
                    await instance.safeTransferFrom(accounts[0], accounts[3], 0, {from: accounts[1]}).should.be.rejectedWith(ERROR_MESSAGE)
                })

                it('nft doesnt exist', async () => {
                    await instance.safeTransferFrom(accounts[0], accounts[3], 5).should.be.rejectedWith(ERROR_MESSAGE);
                })
                it('should reject when _from is not owner', async () => {
                    await instance.safeTransferFrom(accounts[1], accounts[7], 0).should.be.rejectedWith(ERROR_MESSAGE)
                })
            })

            describe('Transfer', () => {
                it('is safely transferred when owner is msg sender', async () => {
                    assert.equal(await instance.balanceOf(accounts[0]), 1)
                    assert.equal(await instance.balanceOf(accounts[5]), 0)

                    const result = await instance.transferFrom(accounts[0], accounts[5], 0);
                    assert.equal(await instance.ownerOf(0), accounts[5])

                    assert.equal(await instance.balanceOf(accounts[0]), 0)
                    assert.equal(await instance.balanceOf(accounts[5]), 1)

                    Emitted(result, 'Transfer', {
                        _from: accounts[0],
                        _to: accounts[5],
                        _tokenId: 0,
                    }, 'Contract should return the correct event.');
                })
                
                it('burn', async () => {
                    assert.equal(await instance.balanceOf(accounts[0]), 1)
                    assert.equal(await instance.balanceOf(DEAD_ADDRESS), 0)

                    const result = await instance.transferFrom(accounts[0], DEAD_ADDRESS, 0);
                    assert.typeOf(await instance.ownerOf(0), 'string')
                    assert.equal(await instance.ownerOf(0), 0)

                    assert.equal(await instance.balanceOf(accounts[0]), 0)

                    Emitted(result, 'Transfer', {
                        _from: accounts[0],
                        _to: 0,
                        _tokenId: 0,
                    }, 'Contract should return the correct event.');
                })
            })
        })
    })

    describe('Withdraw', () => {
        it('Should not withdraw if sender is not owner', async () => {
            const balance = await weiBalance(instance.address)
            await instance.withdraw({from: accounts[1]}).should.be.rejectedWith(ERROR_MESSAGE)
            assert.equal(await weiBalance(instance.address), balance)
        })

        it('Should withdraw to owner', async () => {
            const accountBalance = await weiBalance(accounts[0])
            const balance = await weiBalance(instance.address)
            const result = await instance.withdraw()
            assert.equal(await weiBalance(instance.address), 0)
            // assert.isOk((await weiBalance(accounts[0])) > accountBalance)
        })
    })

    describe('ERC721Metadata', () => {
        it('check name and symbol', async () => {
            assert.equal(await instance.symbol(), "TDC21C")
            assert.equal(await instance.name(), "TDC21 Collections")
        });
    })
})

