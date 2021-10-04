require('chai').use(require('chai-as-promised')).should();

const Ownable = artifacts.require("Ownable");

const { Emitted } = require('./helpers/events')
const { ethBalance } = require('./helpers/balance')
const { DEAD_ADDRESS, ERROR_MESSAGE } = require('./utils/constants')

contract('Ownable', (accounts) => {

    let instance;
    beforeEach(async () => {
        instance = await Ownable.new();
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

    describe('owner', () => {
        it('is owned by first address', async () => {
            const result = await instance.owner()
            assert.typeOf(result, 'string')
            assert.equal(result, accounts[0])
        })
    })

    describe('transferOwnership', () => {
        it('is transferred properly', async () => {
            const result = await instance.transferOwnership(accounts[1])
            assert.equal(await instance.owner(), accounts[1])

            Emitted(result, 'OwnershipTransferred', {
                previousOwner: accounts[0],
                newOwner: accounts[1]
            }, 'Contract should return the correct event.');
        })

        it('cannot transfer ownership if sender is not the owner', async () => {
            await instance.transferOwnership(accounts[2], {
                from: accounts[4]
            }).should.be.rejectedWith(ERROR_MESSAGE);

            assert.equal(await instance.owner(), accounts[0])
        })

        it('cannot transfer ownership if new owner is 0x0', async () => {
            await instance.transferOwnership(DEAD_ADDRESS, { from: accounts[1] }).should.be.rejectedWith(ERROR_MESSAGE);
            assert.equal(await instance.owner(), accounts[0])
        })
    })
})

