import React, { useEffect, useState } from "react";
import "./App.css";
import { Sidebar, SECTIONS_CONFIG, type SidebarSection } from "./components/Sidebar";
import { Footer } from "./components/footer/Footer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { usePipelineStore } from "./stores/pipelineStore";

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SidebarSection>("pipelines");
  const initListeners = usePipelineStore((s) => s.initListeners);
  const refreshDevices = usePipelineStore((s) => s.refreshDevices);

  useEffect(() => {
    initListeners();
    refreshDevices();
  }, [initListeners, refreshDevices]);

  const ActiveComponent = SECTIONS_CONFIG[activeSection].component;

  return (
    <div className="app-root h-screen flex flex-col select-none cursor-default">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <ErrorBoundary>
              <ActiveComponent />
            </ErrorBoundary>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default App;
