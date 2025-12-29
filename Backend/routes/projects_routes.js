import projects_controller from '../controllers/projects_controller.js'; // Added .js extension
import express from 'express';

const router = express.Router();

router.post('/projects/sync', async (_, res) => {
    try {
        const result = await projects_controller.syncProjectsData();
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/projects/all', async (req, res) => {
    const projectId = req.query.projectId; // Get projectId from query parameters
    try {
        const projects = await projects_controller.getProjectsData(projectId);
        res.status(200).json({ data: projects });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/projects/repo-stats', async (req, res) => {
  const result = await projects_controller.getRepoStats();
  res.json(result);
});
router.get('/projects/repo-stats/:repoName', projects_controller.getRepoById);
router.put('/projects/edit/repo-stats/:repoName', projects_controller.editRepoById);
export default router; 


