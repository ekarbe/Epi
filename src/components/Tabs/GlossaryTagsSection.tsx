import { useState, useEffect } from 'react';
import { CollapsibleCategory } from './CollapsibleCategory';
import { BookOpen, Trash2, Plus } from 'lucide-react';
import { useLibrarySettings } from '../../contexts/LibrarySettingsContext';
import { getTags, saveTagContext, deleteTag, Tag, getGlossary, saveGlossaryTerm, deleteGlossaryTerm, GlossaryTerm } from '../../services/db';

export function GlossaryTagsSection() {
  const { refreshLibrary } = useLibrarySettings();
  const [tags, setTags] = useState<Tag[]>([]);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newGlossaryTerm, setNewGlossaryTerm] = useState('');

  const loadData = async () => {
    try {
      const fetchedTags = await getTags();
      setTags(fetchedTags);
      const fetchedGlossary = await getGlossary();
      setGlossary(fetchedGlossary);
    } catch (e) {
      console.error('Failed to load glossary/tags', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTagContextChange = (index: number, newContext: string) => {
    const newTags = [...tags];
    newTags[index].context = newContext;
    setTags(newTags);
  };

  const handleSaveTag = async (tag: Tag) => {
    try {
      await saveTagContext(tag.name, tag.context);
    } catch (e) {
      console.error('Failed to save tag context', e);
    }
  };

  const handleAddTag = async () => {
    const t = newTagName.trim();
    if (!t) return;
    try {
      await saveTagContext(t, '');
      setNewTagName('');
      await loadData();
    } catch (e) {
      console.error('Failed to add tag', e);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    try {
      await deleteTag(tagName);
      await loadData();
      refreshLibrary();
    } catch (e) {
      console.error('Failed to delete tag', e);
    }
  };

  const handleGlossaryMeaningChange = (index: number, newMeaning: string) => {
    const newGlossary = [...glossary];
    newGlossary[index].meaning = newMeaning;
    setGlossary(newGlossary);
  };

  const handleSaveGlossaryTerm = async (term: GlossaryTerm) => {
    try {
      await saveGlossaryTerm(term.term, term.meaning);
    } catch (e) {
      console.error('Failed to save glossary term', e);
    }
  };

  const handleAddGlossaryTerm = async () => {
    const t = newGlossaryTerm.trim();
    if (!t) return;
    try {
      await saveGlossaryTerm(t, '');
      setNewGlossaryTerm('');
      await loadData();
    } catch (e) {
      console.error('Failed to add glossary term', e);
    }
  };

  const handleDeleteGlossaryTerm = async (term: string) => {
    try {
      await deleteGlossaryTerm(term);
      await loadData();
    } catch (e) {
      console.error('Failed to delete glossary term', e);
    }
  };

  return (
    <CollapsibleCategory 
      title="Glossary & Tags" 
      icon={BookOpen} 
      className="glossary-tags-card"
      description="Manage vocabulary for better transcriptions and tag context for the LLM."
    >
        <div style={{ marginTop: '0.5rem' }}>
          {/* GLOSSARY SECTION */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Global Glossary</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Define acronyms and terms. They will be passed to Whisper for better transcription and to the LLM for context.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                className="config-input"
                placeholder="New term (e.g. IGL)"
                value={newGlossaryTerm}
                onChange={e => setNewGlossaryTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddGlossaryTerm()}
                style={{ flex: 1, padding: '0.5rem' }}
              />
              <button className="btn-primary" onClick={handleAddGlossaryTerm} disabled={!newGlossaryTerm.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: 'auto', padding: '0 1rem' }}>
                <Plus size={16} /> Add Term
              </button>
            </div>

            {glossary.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No glossary terms created yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {glossary.map((g, index) => (
                  <div key={g.term} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--card-bg-solid)', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--card-border)' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '120px', fontSize: '0.9rem' }}>{g.term}</span>
                    <input
                      type="text"
                      className="config-input"
                      placeholder={`Meaning of ${g.term} (Optional)...`}
                      value={g.meaning}
                      onChange={(e) => handleGlossaryMeaningChange(index, e.target.value)}
                      onBlur={() => handleSaveGlossaryTerm(g)}
                      style={{ flex: 1, padding: '0.4rem 0.5rem', fontSize: '0.85rem', margin: 0 }}
                    />
                    <button onClick={() => handleDeleteGlossaryTerm(g.term)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }} title="Delete Term">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TAGS SECTION */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Tag Management</h3>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                className="config-input"
                placeholder="New tag name"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                style={{ flex: 1, padding: '0.5rem' }}
              />
              <button className="btn-primary" onClick={handleAddTag} disabled={!newTagName.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: 'auto', padding: '0 1rem' }}>
                <Plus size={16} /> Add Tag
              </button>
            </div>
            
            {tags.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No tags created yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {tags.map((tag, index) => (
                  <div key={tag.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--card-bg-solid)', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--card-border)' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '120px', fontSize: '0.9rem' }}>{tag.name}</span>
                    <input
                      type="text"
                      className="config-input"
                      placeholder={`Context for ${tag.name}...`}
                      value={tag.context}
                      onChange={(e) => handleTagContextChange(index, e.target.value)}
                      onBlur={() => handleSaveTag(tag)}
                      style={{ flex: 1, padding: '0.4rem 0.5rem', fontSize: '0.85rem', margin: 0 }}
                    />
                    <button onClick={() => handleDeleteTag(tag.name)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }} title="Delete Tag">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
    </CollapsibleCategory>
  );
}
