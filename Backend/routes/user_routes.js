import express from 'express';
import userController, {
  getAllContributors,
  getContributorById,
  verifyToken,
  searchContributors,
  loginWithOtp,
} from '../controllers/user_controller.js';

const router = express.Router();

// ======== PUBLIC ROUTES ========



// User login (by phone number)
router.post('/login',loginWithOtp);

// Request OTP
router.post('/users/request-otp', userController.requestOtp);

// Trigger create collections & seed data
router.post('/create-collections', async (req, res) => {
  try {
    await userController.createCollections();
    return res.json({ success: true, message: 'Collections creation started/completed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Sync contributors from Postgres into MongoDB
router.post('/users/sync-contributors', async (req, res) => {
  try {
    const result = await userController.syncContributors();
    if (result && result.success) return res.json(result);
    return res.status(500).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
router.post('/users/signup',userController.signup);


// ======== PROTECTED ROUTES (JWT REQUIRED) ========

// Search contributors  <-- MUST BE FIRST
router.get('/users/contributors/search', searchContributors);

// Get all contributors
router.get('/users/contributors', getAllContributors);

// Get one contributor  <-- MUST BE LAST
router.get('/users/contributors/:userId', getContributorById);

// Permissions
router.get('/users/permissions/extra', verifyToken, userController.getExtraPermissions);
router.put('/users/edit/profile/:userId',userController.editProfile);

export default router;
