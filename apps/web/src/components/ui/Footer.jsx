import 'react';

export default function Footer() {
  return (
    <footer className="bg-zinc-950 px-6 py-12 text-zinc-400">
      <div className="mx-auto max-w-7xl">
        
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          
        
          <div className="flex flex-col gap-4">
        
            <p className="text-sm leading-relaxed text-zinc-500">
              Building modern web solutions with clean user interfaces and powerful functionality.
            </p>
          </div>

 
      

        
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Support</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              <li><a href="#help" className="transition-colors hover:text-cyan-400">Help Center</a></li>
              <li><a href="#contact" className="transition-colors hover:text-cyan-400">Contact Us</a></li>
              <li><a href="#status" className="transition-colors hover:text-cyan-400">System Status</a></li>
            </ul>
          </div>

       
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Legal</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              <li><a href="#privacy" className="transition-colors hover:text-cyan-400">Privacy Policy</a></li>
              <li><a href="#terms" className="transition-colors hover:text-cyan-400">Terms of Service</a></li>
              <li><a href="#cookies" className="transition-colors hover:text-cyan-400">Cookie Settings</a></li>
            </ul>
          </div>

        </div>

       
        <div className="mt-12 border-t border-zinc-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">
            &copy; {new Date().getFullYear()} MyApp Inc. All rights reserved.
          </p>
          
          
        </div>

      </div>
    </footer>
  );
}
