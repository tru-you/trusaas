import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Sparkles,
  Calendar,
  DollarSign,
  TrendingUp,
  FolderPlus,
  Play,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskStatus, Project, Task } from '../../types';
import { ProgressBadge, getProjectProgressStatus, getTaskProgressStatus } from '../common/StatusBadge';

const TASK_COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'Todo', title: 'To Do', color: 'border-slate-700 text-slate-300' },
  { id: 'In Progress', title: 'In Progress', color: 'border-blue-700 text-blue-400' },
  { id: 'Review', title: 'Review & QA', color: 'border-cyan-700 text-cyan-400' },
  { id: 'Done', title: 'Completed', color: 'border-emerald-700 text-emerald-400' },
];

export const ProjectSuite: React.FC = () => {
  const { projects, tasks, addProject, addTask, updateTaskStatus, logTaskHours } = useApp();

  const [selectedProjectId, setSelectedProjectId] = useState<string | 'all'>('all');
  const [projectViewMode, setProjectViewMode] = useState<'cards' | 'table'>('cards');
  const [taskViewMode, setTaskViewMode] = useState<'board' | 'table'>('board');
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAiTaskModal, setShowAiTaskModal] = useState(false);

  // New Project Form State
  const [newProjName, setNewProjName] = useState('');
  const [newProjClient, setNewProjClient] = useState('');
  const [newProjBudget, setNewProjBudget] = useState('35000');
  const [newProjCategory, setNewProjCategory] = useState('Engineering');

  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('Sarah Chen');
  const [newTaskHours, setNewTaskHours] = useState('12');

  // AI Task Generator State
  const [aiProjectGoal, setAiProjectGoal] = useState('');
  const [isGeneratingAiTasks, setIsGeneratingAiTasks] = useState(false);

  const filteredTasks = tasks.filter((t) =>
    selectedProjectId === 'all' ? true : t.projectId === selectedProjectId
  );

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName || !newProjClient) return;

    const proj = addProject({
      name: newProjName,
      clientName: newProjClient,
      status: 'In Progress',
      budget: Number(newProjBudget) || 20000,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category: newProjCategory,
      priority: 'High',
      teamMembers: ['Sarah Chen', 'Alex Rivera'],
    });

    setSelectedProjectId(proj.id);
    setNewProjName('');
    setNewProjClient('');
    setShowAddProjectModal(false);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;

    const targetProjId = selectedProjectId === 'all' ? (projects[0]?.id || 'proj-1') : selectedProjectId;

    addTask({
      projectId: targetProjId,
      title: newTaskTitle,
      assignee: newTaskAssignee,
      priority: 'High',
      status: 'Todo',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedHours: Number(newTaskHours) || 8,
      category: 'General',
    });

    setNewTaskTitle('');
    setShowAddTaskModal(false);
  };

  const handleGenerateTasksWithAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiProjectGoal) return;

    setIsGeneratingAiTasks(true);
    const targetProjId = selectedProjectId === 'all' ? (projects[0]?.id || 'proj-1') : selectedProjectId;

    try {
      const res = await fetch('/api/ai/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectGoal: aiProjectGoal }),
      });
      const data = await res.json();

      if (data.suggestedTasks && Array.isArray(data.suggestedTasks)) {
        data.suggestedTasks.forEach((t: any) => {
          addTask({
            projectId: targetProjId,
            title: t.title,
            assignee: 'Sarah Chen',
            priority: t.priority || 'High',
            status: 'Todo',
            dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            estimatedHours: t.estimatedHours || 8,
            category: t.category || 'AI Generated',
          });
        });
      }
    } catch (err) {
      // Fallback local tasks
      addTask({
        projectId: targetProjId,
        title: `Technical Spec for ${aiProjectGoal}`,
        assignee: 'Sarah Chen',
        priority: 'High',
        status: 'Todo',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estimatedHours: 10,
        category: 'Discovery',
      });
    } finally {
      setIsGeneratingAiTasks(false);
      setAiProjectGoal('');
      setShowAiTaskModal(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto bg-black text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-cyan-400" />
            Project Manager & Task Boards
          </h1>
          <p className="text-sm text-zinc-400">
            Monitor active client delivery, resource hours, and leverage TrueAI task decomposition.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAiTaskModal(true)}
            className="px-3.5 py-2 bg-zinc-900 text-zinc-200 border border-zinc-700 hover:bg-zinc-800 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            AI Task Breakdown
          </button>

          <button
            onClick={() => setShowAddProjectModal(true)}
            className="px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-md"
          >
            <FolderPlus className="w-4 h-4 text-cyan-600" />
            New Project
          </button>
        </div>
      </div>

      {/* Projects Section Header & View Toggle */}
      <div className="flex items-center justify-between pt-1">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Client Projects & Deliverables</h3>
        <div className="bg-slate-950 p-1 rounded-xl flex items-center gap-1 border border-slate-800">
          <button
            onClick={() => setProjectViewMode('cards')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              projectViewMode === 'cards' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Project Cards View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            onClick={() => setProjectViewMode('table')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              projectViewMode === 'table' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Projects Table View"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Projects View: Cards Grid */}
      {projectViewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setSelectedProjectId('all')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedProjectId === 'all'
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-600/30'
                : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">All Active Projects</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                {projects.length} Total
              </span>
            </div>
            <div className="mt-2 text-xl font-extrabold text-white">All Deliverables</div>
            <p className="text-xs opacity-75 mt-1">{tasks.length} active tasks across all clients</p>
          </div>

          {projects.map((p) => {
            const isSelected = selectedProjectId === p.id;
            const projTasks = tasks.filter((t) => t.projectId === p.id);
            const completedTasks = projTasks.filter((t) => t.status === 'Done').length;
            const status = getProjectProgressStatus(p.status, p.progress, p.dueDate);

            return (
              <div
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-600/30'
                    : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-cyan-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 text-xs mb-1">
                    <span className={`font-semibold truncate ${isSelected ? 'text-cyan-100' : 'text-slate-400'}`}>
                      {p.clientName}
                    </span>
                    <ProgressBadge status={status} size="sm" />
                  </div>
                  <h4 className="font-bold text-sm text-white line-clamp-1">{p.name}</h4>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${isSelected ? 'bg-white' : 'bg-emerald-400'}`}
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] opacity-80 pt-1">
                    <span>Budget: ${p.budget.toLocaleString()}</span>
                    <span>{completedTasks}/{projTasks.length} tasks</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Projects View: Full Table View */}
      {projectViewMode === 'table' && (
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Project & Client</th>
                  <th className="px-6 py-3.5">Category & Priority</th>
                  <th className="px-6 py-3.5">Overall Progress</th>
                  <th className="px-6 py-3.5">Target Due Date</th>
                  <th className="px-6 py-3.5">Progress Status</th>
                  <th className="px-6 py-3.5">Budget & Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {projects.map((p) => {
                  const status = getProjectProgressStatus(p.status, p.progress, p.dueDate);
                  const isSelected = selectedProjectId === p.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProjectId(p.id)}
                      className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${isSelected ? 'bg-cyan-950/30' : ''}`}
                    >
                      <td className="px-6 py-4 font-semibold text-slate-100">
                        <p className="font-bold text-white hover:text-cyan-400 transition-colors">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.clientName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-200 font-medium">{p.category}</p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                            p.priority === 'Critical' || p.priority === 'High'
                              ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {p.priority} Priority
                        </span>
                      </td>
                      <td className="px-6 py-4 w-48">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                            <div className="bg-emerald-400 h-full transition-all duration-300" style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-200 font-mono">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-300">
                        {p.dueDate}
                      </td>
                      <td className="px-6 py-4">
                        <ProgressBadge status={status} />
                      </td>
                      <td className="px-6 py-4 font-bold text-white text-xs">
                        <div>${p.budget.toLocaleString()}</div>
                        <span className="text-[10px] text-slate-400 font-normal">Spent: ${p.spent.toLocaleString()}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Board Header & Filter */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            Task Deliverables
            {selectedProjectId !== 'all' && (
              <span className="text-xs text-cyan-400 font-normal">
                (Filtered to {projects.find((p) => p.id === selectedProjectId)?.name})
              </span>
            )}
          </h3>

          <div className="bg-slate-950 p-1 rounded-xl flex items-center gap-1 border border-slate-800 shrink-0">
            <button
              onClick={() => setTaskViewMode('board')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                taskViewMode === 'board' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Kanban</span>
            </button>
            <button
              onClick={() => setTaskViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                taskViewMode === 'table' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tasks Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Table</span>
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowAddTaskModal(true)}
          className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/30"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Task
        </button>
      </div>

      {/* Task Kanban Columns */}
      {taskViewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TASK_COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);

            return (
              <div key={col.id} className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 space-y-3 min-h-[450px] backdrop-blur-md">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>{col.title}</h4>
                  <span className="px-2 py-0.5 bg-slate-950 rounded-full text-xs font-bold text-slate-300 border border-slate-800">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {colTasks.map((task) => {
                    const status = getTaskProgressStatus(task.status, task.dueDate);
                    return (
                      <div
                        key={task.id}
                        className="p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-xs hover:border-cyan-500/50 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-bold text-sm text-slate-100">{task.title}</h5>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              task.priority === 'High'
                                ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        {task.description && <p className="text-xs text-slate-400 line-clamp-2">{task.description}</p>}

                        <div className="flex items-center justify-between pt-1">
                          <ProgressBadge status={status} size="sm" />
                          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {task.dueDate}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                          <span className="flex items-center gap-1 font-medium text-slate-300">
                            <User className="w-3.5 h-3.5 text-cyan-400" />
                            {task.assignee}
                          </span>

                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>{task.loggedHours}/{task.estimatedHours}h</span>
                          </div>
                        </div>

                        {/* Move status buttons */}
                        <div className="flex items-center justify-end gap-1 pt-1">
                          {col.id !== 'Done' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'Done')}
                              className="px-2 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900 rounded-md text-[10px] font-bold flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Mark Complete
                            </button>
                          )}
                          {col.id === 'Todo' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'In Progress')}
                              className="px-2 py-1 bg-blue-950/80 text-blue-400 border border-blue-800/60 hover:bg-blue-900 rounded-md text-[10px] font-bold"
                            >
                              Start
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="h-20 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Table View */}
      {taskViewMode === 'table' && (
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Task Title & Category</th>
                  <th className="px-6 py-3.5">Assignee</th>
                  <th className="px-6 py-3.5">Priority</th>
                  <th className="px-6 py-3.5">Due Date</th>
                  <th className="px-6 py-3.5">Progress Status</th>
                  <th className="px-6 py-3.5">Logged / Est</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTasks.map((task) => {
                  const status = getTaskProgressStatus(task.status, task.dueDate);
                  return (
                    <tr key={task.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-100">
                        <p className="font-bold text-white">{task.title}</p>
                        {task.category && <p className="text-xs text-slate-400">{task.category}</p>}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-200">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-cyan-400" />
                          {task.assignee}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            task.priority === 'High'
                              ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-300">
                        {task.dueDate}
                      </td>
                      <td className="px-6 py-4">
                        <ProgressBadge status={status} />
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-200">
                        {task.loggedHours}/{task.estimatedHours}h
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {task.status !== 'Done' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'Done')}
                              className="px-2.5 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Complete</span>
                            </button>
                          )}
                          {task.status === 'Todo' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'In Progress')}
                              className="px-2.5 py-1 bg-blue-950/80 text-blue-400 border border-blue-800/60 hover:bg-blue-900 rounded-lg text-xs font-semibold transition-colors"
                            >
                              Start
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateProject} className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 space-y-4 text-slate-200">
            <h3 className="text-lg font-bold text-white">Provision Client Project</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NextGen Web App Redesign"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Client Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Logistics"
                  value={newProjClient}
                  onChange={(e) => setNewProjClient(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Project Budget ($)</label>
                <input
                  type="number"
                  required
                  value={newProjBudget}
                  onChange={(e) => setNewProjBudget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddProjectModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTask} className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 space-y-4 text-slate-200">
            <h3 className="text-lg font-bold text-white">Add Task</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Setup Database Schemas"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Assignee</label>
                  <input
                    type="text"
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Estimated Hours</label>
                  <input
                    type="number"
                    value={newTaskHours}
                    onChange={(e) => setNewTaskHours(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-600/30"
              >
                Add Task
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI Task Generator Modal */}
      {showAiTaskModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleGenerateTasksWithAi} className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-lg p-6 space-y-4 text-slate-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
              <h3 className="text-lg font-bold text-white">TrueAI Project Task Generator</h3>
            </div>
            <p className="text-xs text-slate-400">
              Describe the project objective or deliverable feature. TrueAI will automatically break down technical implementation steps and generate tasks for your board.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Project Goal or Deliverable Scope</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Implement multi-currency invoicing with Stripe webhook reconciliation and PDF export"
                value={aiProjectGoal}
                onChange={(e) => setAiProjectGoal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAiTaskModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGeneratingAiTasks}
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-cyan-600/30"
              >
                {isGeneratingAiTasks ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                    Generating Tasks...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Generate & Add Tasks
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
