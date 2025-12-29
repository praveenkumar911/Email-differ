import org_controller from '../controllers/org_controller.js'; // Added .js extension
import express from 'express';

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

router.get('/orgs/:orgId', org_controller.getOrgById);

router.put('/orgs/edit/:orgId', org_controller.editOrg);


export default router;