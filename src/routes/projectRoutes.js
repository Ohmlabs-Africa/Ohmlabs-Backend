import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  addProjectMember,
  createMessage,
  createProject,
  createTask,
  createTicket,
  deleteTask,
  getProject,
  listMessages,
  listProjects,
  listTasks,
  listTickets,
  updateProject,
  updateTask,
  updateTicket,
} from '../controllers/projectController.js';
import { validate } from '../utils/validate.js';

const projectName = body('name').trim().isLength({ min: 2, max: 160 });
const description = () => body('description').optional().trim().isLength({ max: 5000 });
const priority = () => body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']);
const dueDate = () => body('dueDate').optional({ checkFalsy: true }).isISO8601();
const projectStatus = () => body('status').optional().isIn(['planned', 'in_progress', 'on_hold', 'completed']);
const taskStatus = () => body('status').optional().isIn(['todo', 'in_progress', 'in_review', 'blocked', 'completed']);
const ticketStatus = () => body('status').optional().isIn(['open', 'in_progress', 'resolved']);
const projectId = param('projectId').isMongoId();

export function createProjectRoutes() {
  const router = Router();
  router.get('/', listProjects);
  router.post('/', [projectName, description(), priority(), projectStatus(), body('startDate').optional({ checkFalsy: true }).isISO8601(), dueDate()], validate, createProject);
  router.get('/:projectId', [projectId], validate, getProject);
  router.patch('/:projectId', [
    projectId,
    body('name').optional().trim().isLength({ min: 2, max: 160 }),
    description(),
    priority(),
    projectStatus(),
    body('startDate').optional({ checkFalsy: true }).isISO8601(),
    dueDate(),
  ], validate, updateProject);
  router.post('/:projectId/members', [projectId, body('email').trim().isEmail().normalizeEmail()], validate, addProjectMember);

  router.get('/:projectId/tasks', [projectId], validate, listTasks);
  router.post('/:projectId/tasks', [
    projectId,
    body('title').trim().isLength({ min: 1, max: 200 }),
    description(),
    taskStatus(),
    priority(),
    body('assignee').optional({ checkFalsy: true }).isMongoId(),
    dueDate(),
  ], validate, createTask);
  router.patch('/:projectId/tasks/:taskId', [
    projectId,
    param('taskId').isMongoId(),
    body('title').optional().trim().isLength({ min: 1, max: 200 }),
    description(),
    taskStatus(),
    priority(),
    body('assignee').optional({ nullable: true }).isMongoId(),
    dueDate(),
  ], validate, updateTask);
  router.delete('/:projectId/tasks/:taskId', [projectId, param('taskId').isMongoId()], validate, deleteTask);

  router.get('/:projectId/tickets', [projectId], validate, listTickets);
  router.post('/:projectId/tickets', [
    projectId,
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('description').trim().isLength({ min: 1, max: 5000 }),
    priority(),
  ], validate, createTicket);
  router.patch('/:projectId/tickets/:ticketId', [
    projectId,
    param('ticketId').isMongoId(),
    body('title').optional().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim().isLength({ min: 1, max: 5000 }),
    ticketStatus(),
    priority(),
  ], validate, updateTicket);

  router.get('/:projectId/messages', [projectId], validate, listMessages);
  router.post('/:projectId/messages', [
    projectId,
    body('message').trim().isLength({ min: 1, max: 5000 }),
  ], validate, createMessage);
  return router;
}
