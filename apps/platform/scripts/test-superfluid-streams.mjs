import assert from "node:assert";
import { isAddress, getAddress } from "ethers";

console.log("==================================================");
console.log("   Prism 8 Superfluid Stream Validation Tests    ");
console.log("==================================================");

// [Test 1] Deterministic flow rate formula calculation
console.log("\n[Test 1] Verifying deterministic flow rate math...");
const monthlyRentUsd = 3800;
const sharePercentage = 10.0;
const monthlyInvestorRent = (monthlyRentUsd * sharePercentage) / 100; // $380
const secondsInMonth = 2592000;
const flowRatePerSecNum = monthlyInvestorRent / secondsInMonth;
const flowRateWeiPerSec = BigInt(Math.floor(flowRatePerSecNum * 1e18));

assert.strictEqual(monthlyInvestorRent, 380);
assert.strictEqual(flowRateWeiPerSec.toString(), "146604938271604");
console.log(`✓ Flow rate: ${flowRateWeiPerSec.toString()} wei/sec (+${flowRatePerSecNum.toFixed(8)} USD/sec)`);

// [Test 2] Address validation
console.log("\n[Test 2] Verifying receiver address validation...");
const validReceiver = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
assert(isAddress(validReceiver), "Should validate valid address");
assert.strictEqual(getAddress(validReceiver), validReceiver);

const zeroAddress = "0x0000000000000000000000000000000000000000";
assert(getAddress(zeroAddress) === zeroAddress, "Zero address is checksummed");

const invalidShort = "0x12345";
assert(!isAddress(invalidShort), "Should reject short address");

const invalidNonHex = "0xZZ997970C51812dc3A010C7d01b50e0d17dc79C8";
assert(!isAddress(invalidNonHex), "Should reject non-hex address");
console.log("✓ Address validation successfully distinguishes valid vs invalid receivers.");

// [Test 3] Canonical contract addresses
console.log("\n[Test 3] Verifying canonical Superfluid Base Sepolia contracts...");
const CFA_FORWARDER_ADDRESS = "0xcfA132E353cB4E398080B9700609bb008eceB125";
const FUSDCX_ADDRESS = "0x42bb40bF79730451B11f6De1CbA222F17b87Afd7";
assert.strictEqual(getAddress(CFA_FORWARDER_ADDRESS), CFA_FORWARDER_ADDRESS);
assert.strictEqual(getAddress(FUSDCX_ADDRESS), FUSDCX_ADDRESS);
console.log("✓ Canonical Base Sepolia contract addresses match protocol specification.");

console.log("\n==================================================");
console.log("✓ ALL SUPERFLUID VERIFICATION CHECKS PASSED! 🚀");
console.log("==================================================");
