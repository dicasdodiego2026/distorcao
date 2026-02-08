// Test script to verify modal functionality
console.log('=== MODAL TEST ===');

// Check if TradeHistoryModal component exists
import { TradeHistoryModal } from './src/components/TradeHistoryModal.jsx';
console.log('TradeHistoryModal imported:', TradeHistoryModal ? 'YES' : 'NO');

// Check calculations.js for tradeHistory
import { calculateGridStrategy } from './src/utils/calculations.js';
console.log('calculateGridStrategy imported:', calculateGridStrategy ? 'YES' : 'NO');

console.log('Test complete - check browser console for errors');
