import { Router } from 'express';
import { Diagram } from '../models';
import { logger } from '../utils/logger';

const router = Router();

// 다이어그램 목록 조회
router.get('/', async (req, res) => {
  try {
    const { owner, isPublic } = req.query;
    const filter: any = {};

    if (owner) {
      filter.owner = owner;
    }
    if (isPublic !== undefined) {
      filter.isPublic = isPublic === 'true';
    }

    const diagrams = await Diagram.find(filter)
      .select('-bpmnXml') // XML 데이터는 목록에서 제외
      .sort({ lastModified: -1 });

    res.json(diagrams);
  } catch (error) {
    logger.error('Error fetching diagrams:', error);
    res.status(500).json({ error: 'Failed to fetch diagrams' });
  }
});

// 다이어그램 생성
router.post('/', async (req, res) => {
  try {
    const { title, description, bpmnXml, owner, isPublic } = req.body;

    if (!title || !bpmnXml || !owner) {
      return res.status(400).json({ error: 'Title, BPMN XML, and owner are required' });
    }

    const diagram = new Diagram({
      title,
      description,
      bpmnXml,
      owner,
      isPublic: isPublic || false
    });

    await diagram.save();
    res.status(201).json(diagram);
  } catch (error) {
    logger.error('Error creating diagram:', error);
    res.status(500).json({ error: 'Failed to create diagram' });
  }
});

// 다이어그램 조회
router.get('/:id', async (req, res) => {
  try {
    const diagram = await Diagram.findById(req.params.id);
    if (!diagram) {
      return res.status(404).json({ error: 'Diagram not found' });
    }
    res.json(diagram);
  } catch (error) {
    logger.error('Error fetching diagram:', error);
    res.status(500).json({ error: 'Failed to fetch diagram' });
  }
});

// 다이어그램 업데이트
router.put('/:id', async (req, res) => {
  try {
    const { title, description, bpmnXml, isPublic } = req.body;
    
    const updateData: any = {
      lastModified: new Date()
    };

    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (bpmnXml) {
      updateData.bpmnXml = bpmnXml;
      updateData.$inc = { version: 1 };
    }
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const diagram = await Diagram.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!diagram) {
      return res.status(404).json({ error: 'Diagram not found' });
    }

    res.json(diagram);
  } catch (error) {
    logger.error('Error updating diagram:', error);
    res.status(500).json({ error: 'Failed to update diagram' });
  }
});

// 다이어그램 삭제
router.delete('/:id', async (req, res) => {
  try {
    const diagram = await Diagram.findByIdAndDelete(req.params.id);
    if (!diagram) {
      return res.status(404).json({ error: 'Diagram not found' });
    }
    res.json({ message: 'Diagram deleted successfully' });
  } catch (error) {
    logger.error('Error deleting diagram:', error);
    res.status(500).json({ error: 'Failed to delete diagram' });
  }
});

// 협업자 추가
router.post('/:id/collaborators', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const diagram = await Diagram.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { collaborators: userId } },
      { new: true }
    );

    if (!diagram) {
      return res.status(404).json({ error: 'Diagram not found' });
    }

    res.json(diagram);
  } catch (error) {
    logger.error('Error adding collaborator:', error);
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

// 협업자 제거
router.delete('/:id/collaborators/:userId', async (req, res) => {
  try {
    const diagram = await Diagram.findByIdAndUpdate(
      req.params.id,
      { $pull: { collaborators: req.params.userId } },
      { new: true }
    );

    if (!diagram) {
      return res.status(404).json({ error: 'Diagram not found' });
    }

    res.json(diagram);
  } catch (error) {
    logger.error('Error removing collaborator:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

export { router as diagramRouter };