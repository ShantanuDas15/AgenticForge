import apiClient from './apiClient';
import { API_ROUTES } from '@/config/constants';

/**
 * gitService — API wrapper for handling repository integrations and committing code.
 */
export const gitService = {
  /**
   * Commits and pushes the current workspace files to a connected GitHub repository.
   * @param {string} repoName - Target repository (e.g., 'username/repo')
   * @param {string} commitMessage - Commit message
   * @param {Array} files - Array of { filename, content } from useFlowStore
   * @param {string} threadId - Active thread context
   */
  commitAndPush: async (repoName, commitMessage, files, threadId) => {
    if (!repoName) throw new Error('Repository name is required.');
    if (!commitMessage) throw new Error('Commit message is required.');
    
    const { data } = await apiClient.post(API_ROUTES.GIT.COMMIT, { repoName, commitMessage, files, threadId });
    return data;
  }
};
