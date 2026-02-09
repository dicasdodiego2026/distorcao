// Test script to verify BUY logic
const testData = [
    { val: 25, time: '10:00' },   // Should trigger SELL at entry=20
    { val: -25, time: '10:01' },  // Should trigger BUY at entry=20
    { val: 5, time: '10:02' },    // Should close both
];

const initialEntry = 20;
let inTrade = false;
let tradeDirection = null;

console.log('Testing BUY/SELL logic:');
console.log(`Entry threshold: ±${initialEntry} ticks\n`);

testData.forEach((d, i) => {
    console.log(`[${i}] Time: ${d.time}, Distortion: ${d.val} ticks`);

    if (!inTrade) {
        if (d.val >= initialEntry) {
            inTrade = true;
            tradeDirection = 'SELL';
            console.log(`  ✅ SELL Entry triggered!`);
        } else if (d.val <= -initialEntry) {
            inTrade = true;
            tradeDirection = 'BUY';
            console.log(`  ✅ BUY Entry triggered!`);
        } else {
            console.log(`  ⏸️  No entry (dist not extreme enough)`);
        }
    } else {
        console.log(`  📊 In ${tradeDirection} trade`);
    }
    console.log('');
});

console.log('\n🔍 Test Results:');
console.log('If you see both SELL and BUY entries above, the logic is correct!');
console.log('If you only see SELL, there is a bug in the condition.');
