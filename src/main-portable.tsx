/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRoot } from 'react-dom/client';
import App from './App.tsx';

// Entry point for portable build without direct index.css import (CSS is inlined separately)
createRoot(document.getElementById('root')!).render(<App />);
