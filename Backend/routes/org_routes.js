import org_controller from '../controllers/org_controller.js'; // Added .js extension
import express from 'express';
import { verifyToken } from '../controllers/user_controller.js';

const router = express.Router();

router.post('/orgs/sync', async (_, res) => {
    try {
        const result = await org_controller.syncOrgs();
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Fix the get route handler
router.get('/orgs/all', org_controller.getAllOrgs);
router.get("/orgs/query", org_controller.searchOrgs);  
router.get('/orgs/:orgId', org_controller.getOrgById);

router.put('/orgs/edit/:orgId', verifyToken,org_controller.editOrg);
router.get('/orgs/user/:userId', org_controller.getOrgDevelopersbyuserId);
router.get('/orgs/mentors/:userId', org_controller.getOrgMentorsbyuserId);
router.get('/defaultOrgs', org_controller.getDefaultAllOrgs);
export default router;
