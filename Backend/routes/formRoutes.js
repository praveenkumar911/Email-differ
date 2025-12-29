import express from 'express';
const router = express.Router();
import { 
  activateToken,
  validateToken, 
 submitForm, 
  deferForm,
  handleOptOut,
  savePartialForm,
  getPartialForm,
  deletePartialForm,
  checkSyncStatus,
  forceSyncUpdatedData,
  syncToActiveUsers,
  verifyPhoneOtp,
  handleFormClose,
  markOAuthInProgress
} from '../controllers/formController.js';

router.post('/activate', activateToken);        // 👈 NEW
router.get('/validate/:token', validateToken);
router.post('/verify-phone', verifyPhoneOtp);    // 👈 New OTP verification endpoint
router.post('/submit', submitForm);
router.post('/defer', deferForm);
router.post('/close', handleFormClose);
router.post('/optout', handleOptOut);
router.post('/oauth-status', markOAuthInProgress); // 👈 Mark OAuth in progress
router.post('/save-partial', savePartialForm);
router.get('/partial/:token', getPartialForm);
router.delete('/partial/:token', deletePartialForm);
router.get("/sync-status", checkSyncStatus);
// 🔄 Manual sync route
router.post("/force-sync", forceSyncUpdatedData);
router.post("/sync-active-users", syncToActiveUsers);


export default router;