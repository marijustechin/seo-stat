import { ProjectCreateForm } from '@/features/project-create/ui/project-create-form';

export default function NewProjectPage() {
  return (
    <>
      <h1>New project</h1>
      <p className="muted">A project represents a specific business or brand.</p>
      <ProjectCreateForm />
    </>
  );
}
