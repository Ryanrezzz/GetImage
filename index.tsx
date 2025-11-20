/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

// Fix: Define and use AIStudio interface for window.aistudio to resolve type conflict.
// Define the aistudio property on the window object for TypeScript
declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

async function openApiKeyDialog() {
  if (window.aistudio?.openSelectKey) {
    await window.aistudio.openSelectKey();
  } else {
    // This provides a fallback for environments where the dialog isn't available
    showStatusError(
      'API key selection is not available. Please configure the API_KEY environment variable.',
    );
  }
}

const statusEl = document.querySelector('#status') as HTMLDivElement;

async function generateImage(
  prompt: string,
  apiKey: string,
  numberOfImages: number,
) {
  const ai = new GoogleGenAI({apiKey});

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt,
    config: {
      numberOfImages: numberOfImages,
      outputMimeType: 'image/jpeg',
      // personGeneration: 'ALLOW_ADULT',
      // aspectRatio: '16:9',
      // imageSize: '1K',
    },
  });

  const images = response.generatedImages;
  if (images === undefined || images.length === 0) {
    throw new Error(
      'No images were generated. The prompt may have been blocked.',
    );
  }

  outputGrid.innerHTML = '';
  outputGrid.classList.remove('hidden');

  images.forEach((img, index) => {
    const base64ImageBytes = img.image.imageBytes;
    const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

    // Create a container for the image and the download button
    const container = document.createElement('div');
    container.className =
      'relative group rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-gray-900/50 backdrop-blur-md transition-all duration-500 hover:shadow-cyan-500/20 hover:border-cyan-500/30 hover:-translate-y-1';

    const imgEl = document.createElement('img');
    imgEl.src = imageUrl;
    imgEl.alt = `${prompt} (${index + 1})`;
    imgEl.className = 'w-full h-auto block transition-transform duration-700 group-hover:scale-105';

    // Create download button
    const downloadBtn = document.createElement('a');
    downloadBtn.href = imageUrl;
    downloadBtn.download = `imagen-${Date.now()}-${index + 1}.jpg`;
    downloadBtn.className =
      'absolute bottom-4 right-4 bg-black/50 hover:bg-cyan-500/80 text-white p-3 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 translate-y-4 group-hover:translate-y-0 duration-300 shadow-lg border border-white/10 hover:border-transparent';
    downloadBtn.title = 'Download Image';
    downloadBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;

    container.appendChild(imgEl);
    container.appendChild(downloadBtn);
    outputGrid.appendChild(container);
  });
}

// --- DOM Element Selection ---
const promptEl = document.querySelector('#prompt-input') as HTMLTextAreaElement;
const imageCountEl = document.querySelector('#image-count') as HTMLInputElement;
const imageRangeEl = document.querySelector('#image-range') as HTMLInputElement;
const generateButton = document.querySelector(
  '#generate-button',
) as HTMLButtonElement;
const outputGrid = document.querySelector('#output-grid') as HTMLDivElement;

// --- State Variables ---
let prompt = '';

// --- Event Listeners ---
promptEl.addEventListener('input', () => {
  prompt = promptEl.value;
});

// Sync range and number input
if (imageRangeEl && imageCountEl) {
  imageRangeEl.addEventListener('input', () => {
    imageCountEl.value = imageRangeEl.value;
  });
  // Disable manual typing in the number input slightly to encourage slider use,
  // or just ensure sync if they manage to change it
  imageCountEl.addEventListener('change', () => {
     let val = parseInt(imageCountEl.value);
     if(val < 1) val = 1;
     if(val > 4) val = 4;
     imageCountEl.value = val.toString();
     imageRangeEl.value = val.toString();
  });
}

generateButton.addEventListener('click', () => {
  if (!prompt.trim()) {
    showStatusError('Please enter a prompt to generate an image.');
    return;
  }
  generate();
});

// --- Functions ---
function showStatusError(message: string) {
  statusEl.innerHTML = `<span class="text-red-400 bg-red-900/20 px-3 py-1 rounded-full border border-red-500/30 inline-block">${message}</span>`;
}

function setControlsDisabled(disabled: boolean) {
  generateButton.disabled = disabled;
  promptEl.disabled = disabled;
  if (imageCountEl) imageCountEl.disabled = disabled;
  if (imageRangeEl) imageRangeEl.disabled = disabled;
  
  if (disabled) {
    generateButton.classList.add('opacity-50', 'cursor-wait');
  } else {
    generateButton.classList.remove('opacity-50', 'cursor-wait');
  }
}

async function generate() {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    showStatusError('API key is not configured. Please add your API key.');
    await openApiKeyDialog();
    return;
  }

  let numberOfImages = parseInt(imageCountEl.value, 10) || 1;
  // Enforce limits (Imagen usually supports 1-4 images)
  if (numberOfImages < 1) numberOfImages = 1;
  if (numberOfImages > 4) numberOfImages = 4;
  
  // Ensure inputs reflect final value
  imageCountEl.value = numberOfImages.toString();
  if(imageRangeEl) imageRangeEl.value = numberOfImages.toString();

  statusEl.innerHTML = '<span class="text-neon-cyan animate-pulse">Initializing generation protocols...</span>';
  outputGrid.classList.add('hidden');
  outputGrid.innerHTML = '';
  setControlsDisabled(true);

  try {
    await generateImage(prompt, apiKey, numberOfImages);
    statusEl.innerHTML = '<span class="text-green-400">Visualization complete.</span>';
  } catch (e) {
    console.error('Image generation failed:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';

    let userFriendlyMessage = `Error: ${errorMessage}`;
    let shouldOpenDialog = false;

    if (typeof errorMessage === 'string') {
      if (errorMessage.includes('Requested entity was not found.')) {
        userFriendlyMessage =
          'Model not found. This can be caused by an invalid API key or permission issues. Please check your API key.';
        shouldOpenDialog = true;
      } else if (
        errorMessage.includes('API_KEY_INVALID') ||
        errorMessage.includes('API key not valid') ||
        errorMessage.toLowerCase().includes('permission denied')
      ) {
        userFriendlyMessage =
          'Your API key is invalid. Please add a valid API key.';
        shouldOpenDialog = true;
      }
    }

    showStatusError(userFriendlyMessage);

    if (shouldOpenDialog) {
      await openApiKeyDialog();
    }
  } finally {
    setControlsDisabled(false);
  }
}