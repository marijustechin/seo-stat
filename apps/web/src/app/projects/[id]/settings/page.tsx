import { ProjectSettingsForm } from '@/features/project-settings/ui/project-settings-form';

export default function ProjectSettingsPage() {
  return (
    <>
      <h1>Settings</h1>
      <p className="muted">Configure this project. Changes apply to this project only.</p>
      <ProjectSettingsForm />
    </>
  );
}
