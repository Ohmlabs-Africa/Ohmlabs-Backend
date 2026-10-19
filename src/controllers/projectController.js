import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { ProjectTask } from '../models/ProjectTask.js';
import { ProjectTicket } from '../models/ProjectTicket.js';
import { ProjectMessage } from '../models/ProjectMessage.js';
import { SignIn } from '../models/SignIn.js';
import { ok } from '../utils/response.js';

const isAdmin = (req) => req.user.role === 'admin';
export async function getCurrentUser(req, res) {
  const user = await User.findById(req.user.id).select('name email role approvalStatus createdAt');
  return ok(res, user, 'Account fetched');
}

async function accessibleProject(req, projectId) {
  if (!mongoose.isValidObjectId(projectId)) return null;
  const filter = isAdmin(req)
    ? { _id: projectId }
    : { _id: projectId, 'members.user': req.user.id };
  return Project.findOne(filter);
}

function projectPayload(project, taskCounts) {
  const totalTasks = taskCounts?.total || 0;
  const completedTasks = taskCounts?.completed || 0;
  return {
    ...project.toObject(),
    progress: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
    taskCounts: { total: totalTasks, completed: completedTasks },
  };
}

export async function listProjects(req, res) {
  const filter = isAdmin(req) ? {} : { 'members.user': req.user.id };
  const projects = await Project.find(filter).populate('owner', 'name email role').populate('members.user', 'name email role').sort({ updatedAt: -1 });
  const data = await Promise.all(projects.map(async (project) => {
    const [total, completed] = await Promise.all([
      ProjectTask.countDocuments({ project: project._id }),
      ProjectTask.countDocuments({ project: project._id, status: 'completed' }),
    ]);
    return projectPayload(project, { total, completed });
  }));
  return ok(res, data, 'Projects fetched');
}

export async function createProject(req, res) {
  const project = await Project.create({
    name: req.body.name,
    description: req.body.description || '',
    status: req.body.status || 'planned',
    priority: req.body.priority || 'normal',
    startDate: req.body.startDate || undefined,
    dueDate: req.body.dueDate || undefined,
    owner: req.user.id,
    members: [{ user: req.user.id, role: 'owner' }],
  });
  await project.populate('owner', 'name email role');
  await project.populate('members.user', 'name email role');
  return ok(res, projectPayload(project), 'Project created', 201);
}

export async function getProject(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  await project.populate('owner', 'name email role');
  await project.populate('members.user', 'name email role');
  const [total, completed] = await Promise.all([
    ProjectTask.countDocuments({ project: project._id }),
    ProjectTask.countDocuments({ project: project._id, status: 'completed' }),
  ]);
  return ok(res, projectPayload(project, { total, completed }), 'Project fetched');
}

export async function updateProject(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  if (!isAdmin(req) && project.owner.toString() !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Only the project owner or an administrator can edit project details' });
  }
  for (const field of ['name', 'description', 'status', 'priority', 'startDate', 'dueDate']) {
    if (Object.hasOwn(req.body, field)) project[field] = req.body[field] || undefined;
  }
  await project.save();
  await project.populate('owner', 'name email role');
  await project.populate('members.user', 'name email role');
  const [total, completed] = await Promise.all([
    ProjectTask.countDocuments({ project: project._id }),
    ProjectTask.countDocuments({ project: project._id, status: 'completed' }),
  ]);
  return ok(res, projectPayload(project, { total, completed }), 'Project updated');
}

export async function addProjectMember(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  if (!isAdmin(req) && project.owner.toString() !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Only the project owner or an administrator can add members' });
  }
  const user = await User.findOne({ email: req.body.email.toLowerCase(), isActive: true });
  if (!user || (user.role === 'client' && user.approvalStatus !== 'approved')) {
    return res.status(404).json({ success: false, error: 'No active, approved account was found for that email' });
  }
  if (project.members.some((member) => member.user.toString() === user._id.toString())) {
    return res.status(409).json({ success: false, error: 'This user is already a project member' });
  }
  project.members.push({ user: user._id, role: 'member' });
  await project.save();
  await project.populate('owner', 'name email role');
  await project.populate('members.user', 'name email role');
  return ok(res, project, 'Project member added', 201);
}

export async function listTasks(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  const tasks = await ProjectTask.find({ project: project._id })
    .populate('assignee', 'name email')
    .populate('createdBy', 'name email')
    .sort({ dueDate: 1, createdAt: -1 });
  return ok(res, tasks, 'Project tasks fetched');
}

export async function listMyProjectTasks(req, res) {
  const tasks = await ProjectTask.find({ assignee: req.user.id })
    .populate('project', 'name status owner')
    .populate('createdBy', 'name email')
    .populate('assignee', 'name email')
    .sort({ status: 1, dueDate: 1, updatedAt: -1 });
  return ok(res, tasks, 'Assigned project tasks fetched');
}

async function validateAssignee(project, assigneeId) {
  if (!assigneeId) return true;
  if (!mongoose.isValidObjectId(assigneeId)) return false;
  return project.members.some((member) => member.user.toString() === assigneeId);
}

export async function createTask(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  if (!await validateAssignee(project, req.body.assignee)) {
    return res.status(400).json({ success: false, error: 'Assignee must be a member of this project' });
  }
  const task = await ProjectTask.create({
    project: project._id,
    createdBy: req.user.id,
    title: req.body.title,
    description: req.body.description || '',
    status: req.body.status || 'todo',
    priority: req.body.priority || 'normal',
    assignee: req.body.assignee || undefined,
    dueDate: req.body.dueDate || undefined,
  });
  await task.populate('assignee', 'name email');
  await task.populate('createdBy', 'name email');
  return ok(res, task, 'Task created', 201);
}

export async function updateTask(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  if (Object.hasOwn(req.body, 'assignee') && !await validateAssignee(project, req.body.assignee)) {
    return res.status(400).json({ success: false, error: 'Assignee must be a member of this project' });
  }
  const task = await ProjectTask.findOne({ _id: req.params.taskId, project: project._id });
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  for (const field of ['title', 'description', 'status', 'priority', 'assignee', 'dueDate']) {
    if (Object.hasOwn(req.body, field)) task[field] = req.body[field] || undefined;
  }
  await task.save();
  await task.populate('assignee', 'name email');
  await task.populate('createdBy', 'name email');
  return ok(res, task, 'Task updated');
}

export async function deleteTask(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  const task = await ProjectTask.findOne({ _id: req.params.taskId, project: project._id });
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  if (!isAdmin(req) && project.owner.toString() !== req.user.id && task.createdBy.toString() !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Only the task creator, project owner, or an administrator can delete this task' });
  }
  await task.deleteOne();
  return ok(res, null, 'Task deleted');
}

export async function listTickets(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  const tickets = await ProjectTicket.find({ project: project._id }).populate('createdBy', 'name email').sort({ createdAt: -1 });
  return ok(res, tickets, 'Project tickets fetched');
}

export async function createTicket(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  const ticket = await ProjectTicket.create({
    project: project._id,
    createdBy: req.user.id,
    title: req.body.title,
    description: req.body.description,
    priority: req.body.priority || 'normal',
  });
  await ticket.populate('createdBy', 'name email');
  return ok(res, ticket, 'Ticket created', 201);
}

export async function updateTicket(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  const ticket = await ProjectTicket.findOne({ _id: req.params.ticketId, project: project._id });
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
  if (!isAdmin(req) && ticket.createdBy.toString() !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Only the ticket creator or an administrator can update this ticket' });
  }
  for (const field of ['title', 'description', 'status', 'priority']) {
    if (Object.hasOwn(req.body, field)) ticket[field] = req.body[field];
  }
  await ticket.save();
  await ticket.populate('createdBy', 'name email');
  return ok(res, ticket, 'Ticket updated');
}

export async function listMessages(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  const messages = await ProjectMessage.find({ project: project._id })
    .populate('author', 'name email')
    .sort({ createdAt: -1 })
    .limit(200);
  return ok(res, messages.reverse(), 'Project chat fetched');
}

export async function createMessage(req, res) {
  const project = await accessibleProject(req, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  const message = await ProjectMessage.create({
    project: project._id,
    author: req.user.id,
    message: req.body.message,
  });
  await message.populate('author', 'name email');
  return ok(res, message, 'Message sent', 201);
}

export async function getClientDashboardStats(req, res) {
  const [signins, projects, openTickets, myTasks, completedTasks] = await Promise.all([
    SignIn.countDocuments({ user: req.user.id }),
    Project.countDocuments({ 'members.user': req.user.id }),
    ProjectTicket.countDocuments({ createdBy: req.user.id, status: { $ne: 'resolved' } }),
    ProjectTask.countDocuments({ assignee: req.user.id, status: { $ne: 'completed' } }),
    ProjectTask.countDocuments({ assignee: req.user.id, status: 'completed' }),
  ]);
  return ok(res, { signins, projects, openTickets, myTasks, completedTasks }, 'Client dashboard stats fetched');
}

export async function getProjectDashboardStats(req, res) {
  const projectFilter = isAdmin(req) ? {} : { 'members.user': req.user.id };
  const projects = await Project.find(projectFilter).select('_id');
  const projectIds = projects.map(({ _id }) => _id);
  const [openTasks, completedTasks, openTickets, signins] = await Promise.all([
    ProjectTask.countDocuments({ project: { $in: projectIds }, status: { $ne: 'completed' } }),
    ProjectTask.countDocuments({ project: { $in: projectIds }, status: 'completed' }),
    ProjectTicket.countDocuments({ project: { $in: projectIds }, status: { $ne: 'resolved' } }),
    SignIn.countDocuments(isAdmin(req) ? {} : { user: req.user.id }),
  ]);
  return ok(res, {
    projects: projects.length,
    openTasks,
    completedTasks,
    openTickets,
    signins,
  }, 'Project dashboard stats fetched');
}
