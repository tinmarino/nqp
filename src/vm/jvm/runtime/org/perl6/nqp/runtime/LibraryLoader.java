package org.perl6.nqp.runtime;

import java.io.DataInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.util.HashSet;

public class LibraryLoader {
    public void load(ThreadContext tc, String origFilename) {        
        // Don't load the same thing multiple times.
        if (tc.gc.loaded.contains(origFilename))
            return;
        
        try {
            // Read in class data.
            String filename = origFilename;
            File file = new File(filename);
            if (!file.exists() && filename.equals("ModuleLoader.class")) {
                /* We special case the initial ModuleLoader loading. */
                String[] cps = System.getProperty("java.class.path").split("[:;]");
                for (int i = 0; i < cps.length; i++) {
                    file = new File(cps[i] + "/" + filename);
                    if (file.exists()) {
                        filename = cps[i] + "/" + filename;
                        break;
                    }
                }
            }
            byte[] bytes = new byte[(int)file.length()];
            DataInputStream dis = new DataInputStream((new FileInputStream(filename)));
            dis.readFully(bytes);
            dis.close();
            
            // Load the class.
            Class<?> c = loadNew(bytes);
            CompilationUnit cu = (CompilationUnit)c.newInstance();
            cu.initializeCompilationUnit(tc);
            cu.runLoadIfAvailable(tc);
            
            // Note that we already loaded it.
            tc.gc.loaded.add(origFilename);
        }
        catch (ControlException e) {
            throw e;
        }
        catch (Throwable e) {
            throw ExceptionHandling.dieInternal(tc, e.toString());
        }
    }

    public static Class<?> loadNew(byte[] bytes) {
        return new IgnoreNameClassLoader(bytes).loadClass();
    }
    
    private static class IgnoreNameClassLoader extends ClassLoader {
        private byte[] bytes;
        
        public IgnoreNameClassLoader(byte[] bytes) {
            this.bytes = bytes;
        }
        
        public Class<?> loadClass() {
            return defineClass(null, this.bytes, 0, this.bytes.length);
        }
    }
}
